import 'server-only';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { AprobacionPermission } from '@/types/permissions';
import { query } from '@/lib/postgres';
import { kidsIntake, type KidsRosterCampania, type KidsSlot } from '@/lib/kids-intake';
import { edadKidsEnFecha, toISODate } from '@/lib/kids-mapping';

/**
 * GET /api/postgres/aprobacion/kids
 *
 * Consulta "Aprobación › Kids". Fuente de verdad = KIDS2026 (`kidsIntake.roster()`):
 * todas las campañas, cursos y salones con sus matrículas. Cada inscrito se
 * clasifica en `grupo`:
 *   - ACTIVO    → matrícula ACTIVA con contrato KIDS APROBADO
 *   - INACTIVO  → matrícula FINALIZADA/CANCELADA, o contrato ONHOLD/INACTIVO
 *   - RESERVA   → matrícula RESERVADA (retiene cupo, falta aprobar)
 * Se suman como RESERVA (`sinReservaKids: true`) los niños inscritos en LGS
 * (`KIDS_INSCRIPCIONES`) que aún no tienen reserva en KIDS, salvo contratos
 * anulados/retractados, PRB- o filas sin persona.
 * Se enriquece cada inscrito con la ficha LGS (personId, aprobacion, estado).
 * Solo lectura. Gateado por APROBACION.KIDS.VER.
 */

const ANULADOS = ['Contrato nulo', 'Devuelto', 'Rechazado', 'Retractado'];

interface Inscrito {
  ref: string;
  grupo: 'ACTIVO' | 'INACTIVO' | 'RESERVA';
  sinReservaKids: boolean;
  matriculaEstado: string | null;
  contratoEstadoKids: string | null;
  contrato: string;
  ninoNombre: string;
  ninoDoc: string;
  edad: number | null;
  usuarioKids: string | null;
  apoderadoNombre: string;
  apoderadoDoc: string;
  apoderadoEmail: string;
  apoderadoTelefono: string;
  parentesco: string;
  inicio: string | null;
  finalContrato: string | null;
  personId: string | null;
  aprobacionLgs: string | null;
  estadoLgs: string | null;
  inactivoLgs: boolean;
}
interface Salon {
  id: string;
  nombre: string;
  curso: string;
  pais: string | null;
  activo: boolean;
  cupo: number | null;
  ocupados: number | null;
  guia: string | null;
  horario: KidsSlot[];
  /** Horario en texto (solo salones que KIDS no reconoce: viene de LGS). */
  horarioTexto: string | null;
  /** true = salón tomado de LGS que no existe en KIDS. */
  noEnKids: boolean;
  inscritos: Inscrito[];
}
interface Campania {
  id: string;
  nombre: string;
  estado: string;
  inicio: string | null;
  fin: string | null;
  finalVenta: string | null;
  salones: Salon[];
}

const txt = (v: unknown) => String(v ?? '').trim();
const nombreDe = (...partes: unknown[]) => partes.map(txt).filter(Boolean).join(' ');

export const GET = handlerWithStaffAuth(async (_req, _ctx, session) => {
  await requirePermission(session, AprobacionPermission.KIDS_VER);

  // ── KIDS (fuente de verdad). Si falla, se sigue con lo de LGS y se avisa. ──
  let roster: KidsRosterCampania[] = [];
  let error: string | null = null;
  const configured = kidsIntake.isConfigured();
  if (configured) {
    try {
      roster = (await kidsIntake.roster()).campanias || [];
    } catch (e: any) {
      console.error('[aprobacion/kids] KIDS2026 falló:', e?.status, e?.message);
      error = e?.status === 401
        ? 'La clave de servicio de KIDS2026 no es válida (revisar KIDS_INTAKE_API_KEY).'
        : e?.status === 404
          ? 'KIDS2026 aún no tiene la consulta de matrículas (requiere KIDS v13).'
          : `No se pudo consultar KIDS2026: ${e?.message || 'error desconocido'}`;
    }
  }

  // ── LGS: inscripciones Kids + ficha del beneficiario ──
  const lgs = await query(
    `SELECT k."contrato", k."numeroId", k."nombre", k."campaign", k."tipoCurso", k."classroomId",
            k."salonNombre", k."horario", k."apoderado", k."apoderadoApellidos", k."apoderadoDoc",
            k."apoderadoTelefono", k."apoderadoMail", k."parentesco", k."kidsExternalRef",
            p."_id" AS "personId", p."numeroId" AS "pNumeroId", p."aprobacion", p."estado",
            p."estadoInactivo", p."fechaNacimiento",
            p."primerNombre", p."segundoNombre", p."primerApellido", p."segundoApellido"
       FROM "KIDS_INSCRIPCIONES" k
       LEFT JOIN "PEOPLE" p ON p."_id" = k."beneficiarioId"`,
  );
  const refsKids = new Set(
    roster.flatMap((c) => c.cursos.flatMap((cu) => cu.salones.flatMap((s) => s.matriculas.map((m) => m.externalRef || '')))),
  );
  const contratosKids = Array.from(new Set(Array.from(refsKids).map((r) => r.split('#')[0]).filter(Boolean)));

  // Fichas LGS de los niños que están en KIDS (por contrato#documento).
  const fichas = new Map<string, any>();
  if (contratosKids.length) {
    const r = await query(
      `SELECT "_id", "contrato", "numeroId", "aprobacion", "estado", "estadoInactivo"
         FROM "PEOPLE"
        WHERE "tipoUsuario" = 'BENEFICIARIO' AND "contrato" = ANY($1::text[])`,
      [contratosKids],
    );
    for (const p of r.rows as any[]) fichas.set(`${txt(p.contrato)}#${txt(p.numeroId)}`, p);
  }

  // ── Armado: campaña → salones (curso aplanado) → inscritos ──
  const campanias: Campania[] = [];
  const salonPorId = new Map<string, Salon>();
  for (const c of roster) {
    const camp: Campania = {
      id: c.id, nombre: c.nombre, estado: c.estado,
      inicio: c.inicio || null, fin: c.fin || null, finalVenta: c.finalVenta || null, salones: [],
    };
    for (const cu of c.cursos) {
      for (const s of cu.salones) {
        const salon: Salon = {
          id: s.id, nombre: s.nombre, curso: cu.tipo, pais: s.pais || null, activo: s.activo,
          cupo: s.cupo, ocupados: s.ocupados, guia: s.guia, horario: s.horario || [],
          horarioTexto: null, noEnKids: false,
          inscritos: s.matriculas.map((m) => {
            const ref = m.externalRef || '';
            const ficha = fichas.get(ref);
            const grupo: Inscrito['grupo'] = m.matriculaEstado === 'RESERVADA'
              ? 'RESERVA'
              : m.matriculaEstado === 'ACTIVA' && m.contratoEstado === 'APROBADO' ? 'ACTIVO' : 'INACTIVO';
            return {
              ref,
              grupo,
              sinReservaKids: false,
              matriculaEstado: m.matriculaEstado,
              contratoEstadoKids: m.contratoEstado,
              contrato: ref.split('#')[0] || String(m.contratoNumero),
              ninoNombre: nombreDe(m.nino.nombres, m.nino.apellidos),
              ninoDoc: m.nino.docNumero,
              edad: edadKidsEnFecha(m.nino.fechaNacimiento),
              usuarioKids: m.nino.username,
              apoderadoNombre: m.apoderado ? nombreDe(m.apoderado.nombres, m.apoderado.apellidos) : '',
              apoderadoDoc: m.apoderado?.docNumero || '',
              apoderadoEmail: m.apoderado?.email || '',
              apoderadoTelefono: m.apoderado?.telefono || '',
              parentesco: m.apoderado?.parentesco || '',
              inicio: m.inicio || null,
              finalContrato: m.finalContrato || null,
              personId: ficha?._id || null,
              aprobacionLgs: ficha?.aprobacion || null,
              estadoLgs: ficha?.estado || null,
              inactivoLgs: ficha?.estadoInactivo === true,
            };
          }),
        };
        camp.salones.push(salon);
        salonPorId.set(s.id, salon);
      }
    }
    campanias.push(camp);
  }

  // ── Inscritos en LGS sin reserva en KIDS → RESERVA (sinReservaKids) ──
  for (const k of lgs.rows as any[]) {
    const contrato = txt(k.contrato);
    if (!k.personId || !contrato || contrato.startsWith('PRB-')) continue;
    if (ANULADOS.includes(txt(k.aprobacion)) || txt(k.estado).toUpperCase() === 'RETRACTADO') continue;
    const ref = txt(k.kidsExternalRef) || `${contrato}#${txt(k.pNumeroId || k.numeroId)}`;
    if (refsKids.has(ref)) continue;

    let salon = k.classroomId ? salonPorId.get(String(k.classroomId)) : undefined;
    if (!salon) {
      // Salón que KIDS no reconoce: se agrupa bajo la campaña por nombre.
      const nombreCamp = txt(k.campaign) || '(sin campaña)';
      let camp = campanias.find((c) => c.nombre === nombreCamp);
      if (!camp) {
        camp = { id: `lgs:${nombreCamp}`, nombre: nombreCamp, estado: '', inicio: null, fin: null, finalVenta: null, salones: [] };
        campanias.push(camp);
      }
      const idPseudo = `lgs:${nombreCamp}:${txt(k.tipoCurso)}:${txt(k.salonNombre) || txt(k.classroomId)}`;
      salon = camp.salones.find((s) => s.id === idPseudo);
      if (!salon) {
        salon = {
          id: idPseudo, nombre: txt(k.salonNombre) || '(salón sin identificar)', curso: txt(k.tipoCurso).toUpperCase(),
          pais: null, activo: true, cupo: null, ocupados: null, guia: null, horario: [],
          horarioTexto: txt(k.horario) || null, noEnKids: true, inscritos: [],
        };
        camp.salones.push(salon);
      }
    }
    salon.inscritos.push({
      ref,
      grupo: 'RESERVA',
      sinReservaKids: true,
      matriculaEstado: null,
      contratoEstadoKids: null,
      contrato,
      ninoNombre: nombreDe(k.primerNombre, k.segundoNombre, k.primerApellido, k.segundoApellido) || txt(k.nombre),
      ninoDoc: txt(k.pNumeroId || k.numeroId),
      edad: edadKidsEnFecha(toISODate(k.fechaNacimiento)),
      usuarioKids: null,
      apoderadoNombre: nombreDe(k.apoderado, k.apoderadoApellidos),
      apoderadoDoc: txt(k.apoderadoDoc),
      apoderadoEmail: txt(k.apoderadoMail),
      apoderadoTelefono: txt(k.apoderadoTelefono),
      parentesco: txt(k.parentesco),
      inicio: null,
      finalContrato: null,
      personId: k.personId,
      aprobacionLgs: k.aprobacion || null,
      estadoLgs: k.estado || null,
      inactivoLgs: k.estadoInactivo === true,
    });
  }

  for (const c of campanias) {
    for (const s of c.salones) s.inscritos.sort((a, b) => a.ninoNombre.localeCompare(b.ninoNombre, 'es'));
  }

  return successResponse({ configured, error, campanias, consultado: new Date().toISOString() });
});
