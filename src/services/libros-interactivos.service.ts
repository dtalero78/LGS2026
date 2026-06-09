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

export interface VisorMetadata {
  libroCodigo: string;
  libroTitulo: string;
  totalPaginas: number;
  totalPaginasLibro: number;
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

    const paginasConAudioLocales = (libro.audios || [])
      .filter(a => a.pagina >= inicio && a.pagina <= fin)
      .map(a => a.pagina - inicio + 1);

    return {
      libroCodigo: libro.codigo,
      libroTitulo: libro.titulo,
      totalPaginas,
      totalPaginasLibro: libro.totalPaginas,
      paginasConAudio: paginasConAudioLocales,
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
    return getPresignedVideoUrl(key, 600);
  }

  /** Presigned URL del audio si existe (cache-friendly). */
  async getAudioPresignedUrl(nivelCode: string, paginaLocal: number): Promise<string | null> {
    const resolved = await this.resolveNivelLibro(nivelCode);
    if (!resolved || !resolved.libro || !resolved.libro.activo) return null;

    const libro = resolved.libro;
    const inicio = Math.max(1, resolved.libroPaginaInicio ?? 1);
    const paginaLibro = inicio + paginaLocal - 1;
    const audio = (libro.audios || []).find(a => a.pagina === paginaLibro);
    if (!audio) return null;

    const key = `materials/interactive/${libro.codigo}/${audio.key}`;
    return getPresignedVideoUrl(key, 600);
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
