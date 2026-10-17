/**
 * Search Service
 *
 * Unified search across PEOPLE and ACADEMICA tables.
 * Si no hay resultados, se busca además en KIDS2026 (roster) por nombre o
 * documento del niño: un kid creado en LGS vive en PEOPLE (kids=true), pero si
 * su ficha no coincide (o solo existe en KIDS) igual se muestra como
 * beneficiario Kids en vez de "No se encontraron resultados".
 */

import 'server-only';
import { PeopleRepository } from '@/repositories/people.repository';
import { AcademicaRepository } from '@/repositories/academica.repository';
import { ValidationError } from '@/lib/errors';
import { kidsIntake } from '@/lib/kids-intake';
import { queryMany } from '@/lib/postgres';

export interface KidsSearchResult {
  nombre: string;
  docNumero: string;
  contrato: string | null;
  campania: string;
  curso: string;
  salon: string;
  matriculaEstado: string;
  contratoEstado: string;
  apoderado: string | null;
  /** Ficha LGS del niño (PEOPLE kids=true) o, si no existe, la del titular del contrato. */
  personId: string | null;
  enLgs: boolean;
}

const norm = (s: string) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const soloDigitos = (s: string) => (s || '').replace(/[^0-9kK]/g, '').toLowerCase();

async function buscarEnKids(term: string, limit: number): Promise<KidsSearchResult[]> {
  if (!kidsIntake.isConfigured()) return [];
  let campanias;
  try { campanias = (await kidsIntake.roster()).campanias || []; } catch { return []; }

  const t = norm(term);
  const tDoc = soloDigitos(term);
  const palabras = t.split(/\s+/).filter(Boolean);
  const hallados: KidsSearchResult[] = [];
  const vistos = new Set<string>();

  for (const camp of campanias) {
    for (const curso of camp.cursos || []) {
      for (const salon of curso.salones || []) {
        for (const m of salon.matriculas || []) {
          const nombre = `${m.nino?.nombres || ''} ${m.nino?.apellidos || ''}`.trim();
          const doc = m.nino?.docNumero || '';
          const porDoc = tDoc.length >= 4 && soloDigitos(doc).includes(tDoc);
          const n = norm(nombre);
          const porNombre = palabras.length > 0 && palabras.every((p) => n.includes(p));
          if (!porDoc && !porNombre) continue;
          const clave = `${m.externalRef || ''}|${doc}|${camp.id}`;
          if (vistos.has(clave)) continue;
          vistos.add(clave);
          const contrato = m.externalRef ? m.externalRef.split('#')[0] : null;
          hallados.push({
            nombre, docNumero: doc, contrato,
            campania: camp.nombre, curso: curso.tipo, salon: salon.nombre,
            matriculaEstado: m.matriculaEstado, contratoEstado: m.contratoEstado,
            apoderado: m.apoderado ? `${m.apoderado.nombres} ${m.apoderado.apellidos}`.trim() : null,
            personId: null, enLgs: false,
          });
          if (hallados.length >= limit) break;
        }
      }
    }
  }
  if (!hallados.length) return [];

  // Cruce con LGS: ficha del niño (mismo contrato + documento) o, si no, el titular.
  const contratos = Array.from(new Set(hallados.map((h) => h.contrato).filter(Boolean))) as string[];
  if (contratos.length) {
    const filas = await queryMany<{ _id: string; contrato: string; numeroId: string; tipoUsuario: string; kids: boolean }>(
      `SELECT "_id", "contrato", "numeroId", "tipoUsuario", "kids" FROM "PEOPLE" WHERE "contrato" = ANY($1)`,
      [contratos],
    );
    for (const h of hallados) {
      const delContrato = filas.filter((f) => f.contrato === h.contrato);
      const nino = delContrato.find((f) => f.tipoUsuario === 'BENEFICIARIO' && soloDigitos(f.numeroId) === soloDigitos(h.docNumero));
      const titular = delContrato.find((f) => f.tipoUsuario === 'TITULAR');
      h.enLgs = !!nino;
      h.personId = nino?._id || titular?._id || null;
    }
  }
  return hallados;
}

/**
 * Unified search: searches PEOPLE and ACADEMICA in parallel.
 * Matches by primerNombre, primerApellido, numeroId, or contrato.
 */
export async function unifiedSearch(term: string, limit: number = 100) {
  if (!term || term.trim().length < 2) {
    throw new ValidationError('Search term must be at least 2 characters');
  }

  const trimmed = term.trim();

  const [people, academica] = await Promise.all([
    PeopleRepository.searchUnified(trimmed, limit),
    AcademicaRepository.searchWithPeople(trimmed, limit),
  ]);

  // Lo que la barra muestra: titulares, fichas académicas y beneficiarios Kids.
  // Si nada de eso aparece, se pregunta a KIDS antes de responder "sin resultados".
  const visibles = academica.length
    + people.filter((p: any) => p.tipoUsuario === 'TITULAR' || p.kids === true).length;
  const kids = visibles === 0 ? await buscarEnKids(trimmed, 20) : [];

  return {
    people,
    academica,
    kids,
    totalCount: people.length + academica.length + kids.length,
  };
}
