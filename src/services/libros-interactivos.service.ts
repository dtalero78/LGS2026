/**
 * Libros Interactivos Service
 *
 * Optimizaciones de carga aplicadas:
 *  - 1 query con JOIN (nivel↔libro) en vez de 2 separadas.
 *  - Cache in-memory por nivel con TTL corto. Reduce queries en 95% cuando
 *    el panel-estudiante se recarga durante la sesión activa.
 *  - Cache in-memory del feature flag (1 query menos por request).
 *
 * Las páginas viven en Spaces como:
 *   materials/interactive/{codigoLibro}/page-NNN.jpg
 *   materials/interactive/{codigoLibro}/audio/page-NNN.mp3
 *
 * "Página local" = la que ve el estudiante (1..N donde N = totalPaginasNivel).
 * "Página libro" = la que vive físicamente en Spaces.
 */

import 'server-only';
import { getPresignedVideoUrl } from '@/lib/spaces';
import {
  LibrosInteractivosRepository,
  NivelLibroBindingRepository,
  LibroAudio,
} from '@/repositories/libros-interactivos.repository';
import { AppConfigRepository } from '@/repositories/config.repository';
import { NotFoundError, ValidationError } from '@/lib/errors';

const FEATURE_FLAG_KEY = 'material_interactivo_v2_activo';
// Flag independiente para mostrar/ocultar el botón "Material Interactivo (clásico)"
// (enlace Wix). Default TRUE (si el registro no existe) → preserva el comportamiento
// actual hasta que un admin lo apague.
const CLASICO_FLAG_KEY = 'material_interactivo_clasico_activo';
// Flag de la Fase 2 (ejercicios de práctica auto-gradables). Default FALSE si no
// existe → la feature no se ve hasta que un admin la encienda.
const EJERCICIOS_FLAG_KEY = 'material_interactivo_ejercicios_activo';

// ── Cache module-level (vive entre requests dentro de la misma instancia) ──

type NivelLibroResolved = {
  nivelCode: string;
  libroPaginaInicio: number | null;
  libroPaginaFin: number | null;
  libro: {
    codigo: string;
    titulo: string;
    totalPaginas: number;
    audios: LibroAudio[];
    activo: boolean;
  } | null;
};

const NIVEL_TTL_MS = 5 * 60 * 1000;   // 5 min — libros y audios cambian poco
const FLAG_TTL_MS  = 60 * 1000;       // 1 min — flag puede activarse y queremos rapido

const nivelCache = new Map<string, { value: NivelLibroResolved | null; expires: number }>();
let flagCache: { value: boolean; expires: number } | null = null;
let clasicoFlagCache: { value: boolean; expires: number } | null = null;
let ejerciciosFlagCache: { value: boolean; expires: number } | null = null;

function getNivelCached(code: string): NivelLibroResolved | null | undefined {
  const hit = nivelCache.get(code);
  if (hit && hit.expires > Date.now()) return hit.value;
  if (hit) nivelCache.delete(code);
  return undefined;
}

function setNivelCached(code: string, value: NivelLibroResolved | null): void {
  nivelCache.set(code, { value, expires: Date.now() + NIVEL_TTL_MS });
}

/** Invalida cache de un nivel (admin tras editar binding/audios). */
function invalidateNivelCache(codeOrAll?: string): void {
  if (!codeOrAll) {
    nivelCache.clear();
  } else {
    nivelCache.delete(codeOrAll);
  }
}

/** Invalida todos los niveles que apuntan a un libro (admin tras editar audios del libro). */
function invalidateLibroCache(libroCodigo: string): void {
  for (const [k, v] of nivelCache.entries()) {
    if (v.value?.libro?.codigo === libroCodigo) nivelCache.delete(k);
  }
}

export interface VisorAudioInfo {
  /** Índice (0..N-1) entre los audios de la misma página local. Identifica
   *  cuál pedir presigned. La key real se mantiene server-only. */
  idx: number;
  titulo: string | null;
}

export interface VisorMetadata {
  libroCodigo: string;
  libroTitulo: string;
  totalPaginas: number;
  totalPaginasLibro: number;
  /**
   * Mapa pagina-local → lista de audios disponibles (ordenados por título).
   * Si una página no tiene audios, no aparece en el map.
   * Ej: { 8: [{idx:0,titulo:'Diálogo'}, {idx:1,titulo:'María'}, {idx:2,titulo:'John'}] }
   */
  audiosPorPagina: Record<number, VisorAudioInfo[]>;
  /** Compat: lista de páginas-locales con al menos 1 audio. */
  paginasConAudio: number[];
}

class LibrosInteractivosServiceClass {
  /** Lee el feature flag global con cache TTL 60s. */
  async isFeatureActive(): Promise<boolean> {
    const now = Date.now();
    if (flagCache && flagCache.expires > now) return flagCache.value;
    const row = await AppConfigRepository.get(FEATURE_FLAG_KEY);
    const value = row?.value === 'true';
    flagCache = { value, expires: now + FLAG_TTL_MS };
    return value;
  }

  /** Activa/desactiva el feature flag (admin). Invalida cache. */
  async setFeatureActive(active: boolean, actor: string): Promise<void> {
    await AppConfigRepository.set(FEATURE_FLAG_KEY, active ? 'true' : 'false', '#ffffff', actor);
    flagCache = null;
  }

  /**
   * ¿Debe mostrarse el botón "Material Interactivo (clásico)" (enlace Wix)?
   * Default TRUE si el registro no existe (comportamiento actual preservado).
   */
  async isClasicoActive(): Promise<boolean> {
    const now = Date.now();
    if (clasicoFlagCache && clasicoFlagCache.expires > now) return clasicoFlagCache.value;
    const row = await AppConfigRepository.get(CLASICO_FLAG_KEY);
    const value = row ? row.value === 'true' : true;
    clasicoFlagCache = { value, expires: now + FLAG_TTL_MS };
    return value;
  }

  /** Activa/desactiva el botón clásico (admin). Invalida cache. */
  async setClasicoActive(active: boolean, actor: string): Promise<void> {
    await AppConfigRepository.set(CLASICO_FLAG_KEY, active ? 'true' : 'false', '#ffffff', actor);
    clasicoFlagCache = null;
  }

  /** ¿Está activa la Fase 2 (ejercicios de práctica)? Default FALSE si no existe. */
  async isEjerciciosActive(): Promise<boolean> {
    const now = Date.now();
    if (ejerciciosFlagCache && ejerciciosFlagCache.expires > now) return ejerciciosFlagCache.value;
    const row = await AppConfigRepository.get(EJERCICIOS_FLAG_KEY);
    const value = row?.value === 'true';
    ejerciciosFlagCache = { value, expires: now + FLAG_TTL_MS };
    return value;
  }

  /** Activa/desactiva la Fase 2 (admin). Invalida cache. */
  async setEjerciciosActive(active: boolean, actor: string): Promise<void> {
    await AppConfigRepository.set(EJERCICIOS_FLAG_KEY, active ? 'true' : 'false', '#ffffff', actor);
    ejerciciosFlagCache = null;
  }

  /**
   * Resuelve binding + libro del nivel en 1 query con cache.
   * Devuelve null si el nivel no tiene libro o el libro está inactivo.
   */
  private async resolveNivelLibro(nivelCode: string): Promise<NivelLibroResolved | null> {
    const cached = getNivelCached(nivelCode);
    if (cached !== undefined) return cached;
    const row = await NivelLibroBindingRepository.findNivelWithLibro(nivelCode);
    const value = row ?? null;
    setNivelCached(nivelCode, value);
    return value;
  }

  /**
   * Resuelve la metadata que necesita el visor para un nivel dado.
   * Lanza NotFoundError si el nivel no tiene libro asociado o el libro no existe.
   */
  async getMetadataForNivel(nivelCode: string): Promise<VisorMetadata> {
    const resolved = await this.resolveNivelLibro(nivelCode);
    if (!resolved || !resolved.libro || !resolved.libro.activo) {
      throw new NotFoundError('LibroInteractivo', `nivel=${nivelCode}`);
    }
    const libro = resolved.libro;
    if (!libro.totalPaginas || libro.totalPaginas <= 0) {
      throw new ValidationError('El libro aún no tiene páginas cargadas');
    }

    const inicio = Math.max(1, resolved.libroPaginaInicio ?? 1);
    const finRaw = resolved.libroPaginaFin ?? libro.totalPaginas;
    const fin = Math.min(libro.totalPaginas, Math.max(inicio, finRaw));
    const totalPaginas = fin - inicio + 1;

    // Agrupa audios por página local. Misma página puede tener N audios.
    const audiosPorPagina: Record<number, VisorAudioInfo[]> = {};
    const audiosOrdenados = [...(libro.audios || [])]
      .filter(a => a.pagina >= inicio && a.pagina <= fin)
      .sort((a, b) => {
        if (a.pagina !== b.pagina) return a.pagina - b.pagina;
        return (a.titulo || '').localeCompare(b.titulo || '');
      });

    for (const a of audiosOrdenados) {
      const paginaLocal = a.pagina - inicio + 1;
      const arr = audiosPorPagina[paginaLocal] || [];
      arr.push({ idx: arr.length, titulo: a.titulo ?? null });
      audiosPorPagina[paginaLocal] = arr;
    }

    return {
      libroCodigo: libro.codigo,
      libroTitulo: libro.titulo,
      totalPaginas,
      totalPaginasLibro: libro.totalPaginas,
      audiosPorPagina,
      paginasConAudio: Object.keys(audiosPorPagina).map(Number),
    };
  }

  /**
   * Presigned URL de la imagen de una página LOCAL del nivel.
   * Usa el resolver cacheado (cero queries en cache-hit).
   */
  async getPagePresignedUrl(nivelCode: string, paginaLocal: number): Promise<string> {
    const resolved = await this.resolveNivelLibro(nivelCode);
    if (!resolved || !resolved.libro || !resolved.libro.activo) {
      throw new NotFoundError('LibroInteractivo', `nivel=${nivelCode}`);
    }
    const libro = resolved.libro;
    const inicio = Math.max(1, resolved.libroPaginaInicio ?? 1);
    const fin = Math.min(libro.totalPaginas, resolved.libroPaginaFin ?? libro.totalPaginas);
    const totalPaginasNivel = fin - inicio + 1;

    if (!Number.isInteger(paginaLocal) || paginaLocal < 1 || paginaLocal > totalPaginasNivel) {
      throw new ValidationError(`Página ${paginaLocal} fuera de rango (1..${totalPaginasNivel})`);
    }

    const paginaLibro = inicio + paginaLocal - 1;
    const key = `materials/interactive/${libro.codigo}/page-${String(paginaLibro).padStart(3, '0')}.jpg`;
    // TTL 1h: el cliente cachea la URL; con 10min expiraba a mitad de la lectura
    // (ícono de imagen rota). El cliente además se auto-repara con onError.
    return getPresignedVideoUrl(key, 3600);
  }

  /**
   * Presigned URLs de TODOS los audios de una página local.
   * Retorna array vacío si no hay audios para esa página.
   * Cada elemento incluye `idx` (orden), `titulo` y `url`.
   */
  async getAudiosForPage(
    nivelCode: string,
    paginaLocal: number,
  ): Promise<Array<{ idx: number; titulo: string | null; url: string }>> {
    const resolved = await this.resolveNivelLibro(nivelCode);
    if (!resolved || !resolved.libro || !resolved.libro.activo) return [];

    const libro = resolved.libro;
    const inicio = Math.max(1, resolved.libroPaginaInicio ?? 1);
    const paginaLibro = inicio + paginaLocal - 1;
    const audiosPagina = (libro.audios || [])
      .filter(a => a.pagina === paginaLibro)
      .sort((a, b) => (a.titulo || '').localeCompare(b.titulo || ''));

    if (audiosPagina.length === 0) return [];

    const result = await Promise.all(
      audiosPagina.map(async (audio, idx) => {
        const fullKey = `materials/interactive/${libro.codigo}/${audio.key}`;
        const url = await getPresignedVideoUrl(fullKey, 3600); // TTL 1h (igual que páginas)
        return { idx, titulo: audio.titulo ?? null, url };
      }),
    );
    return result;
  }

  /**
   * Compat: presigned URL del PRIMER audio de la página (orden por título).
   * Mantenido temporalmente por si algún cliente viejo aún consulta de a uno.
   */
  async getAudioPresignedUrl(nivelCode: string, paginaLocal: number): Promise<string | null> {
    const audios = await this.getAudiosForPage(nivelCode, paginaLocal);
    return audios[0]?.url ?? null;
  }

  /** Catálogo admin (no se cachea — el admin debe ver siempre fresh). */
  async listAllForAdmin() {
    const [libros, bindings] = await Promise.all([
      LibrosInteractivosRepository.findAll({ includeInactive: true }),
      NivelLibroBindingRepository.findAll(),
    ]);

    const bindingsPorLibro = new Map<string, typeof bindings>();
    for (const b of bindings) {
      if (!b.libroInteractivoCode) continue;
      const arr = bindingsPorLibro.get(b.libroInteractivoCode) ?? [];
      arr.push(b);
      bindingsPorLibro.set(b.libroInteractivoCode, arr);
    }

    return libros.map(libro => ({
      ...libro,
      niveles: bindingsPorLibro.get(libro.codigo) ?? [],
    }));
  }

  /** Permite al admin invalidar caché tras editar (binding, audios). */
  invalidateNivelCache = invalidateNivelCache;
  invalidateLibroCache = invalidateLibroCache;
}

export const LibrosInteractivosService = new LibrosInteractivosServiceClass();
