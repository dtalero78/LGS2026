import type { KidsReservationInput, KidsPersona } from '@/lib/kids-intake';

/**
 * Mapeo de los datos de LGS al contrato de datos del intake de KIDS2026.
 * `docTipo` es un valor fijo (decisión de negocio) para titular, apoderado y niño.
 */
const DOC_TIPO = 'CC';

/** Plataforma (país) de LGS → countryCode de 2 letras que exige KIDS. */
export function plataformaToCountryCode(plataforma?: string | null): string {
  const p = (plataforma || '').trim().toLowerCase();
  if (p.startsWith('chile')) return 'CL';
  if (p.startsWith('colombia')) return 'CO';
  if (p.startsWith('ecuador')) return 'EC';
  if (p.startsWith('per')) return 'PE'; // Perú / peru
  return 'CO';
}

/** Fecha a formato YYYY-MM-DD (lo que exige el intake). '' si no hay valor. */
export function toISODate(v: any): string {
  if (!v) return '';
  if (typeof v === 'string') return v.slice(0, 10);
  try { return new Date(v).toISOString().slice(0, 10); } catch { return ''; }
}

/**
 * Rango de edad por curso — MISMA regla que KIDS2026 (contracts/domain/edad.ts):
 * edad cumplida a la fecha de inicio de la reserva (hoy). Si no cuadra, KIDS
 * rechaza la reserva ("La edad del niño a la fecha de inicio… no corresponde…").
 */
export const RANGO_EDAD_CURSO: Record<string, { min: number; max: number; etiqueta: string }> = {
  JUNIOR: { min: 6, max: 9, etiqueta: 'Junior (6–9 años)' },
  YOUNGSTER: { min: 10, max: 13, etiqueta: 'Youngster (10–13 años)' },
};

/** Edad cumplida en `fecha` (YYYY-MM-DD). null si la fecha de nacimiento no es válida. */
export function edadKidsEnFecha(fechaNacimiento: any, fecha: string = new Date().toISOString().slice(0, 10)): number | null {
  const fn = toISODate(fechaNacimiento);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fn)) return null;
  const [ny, nm, nd] = fn.split('-').map(Number);
  const [fy, fm, fd] = fecha.split('-').map(Number);
  // Fecha incompleta o absurda (el <input type="date"> entrega años parciales como
  // "0202" mientras se escribe) o futura → no hay edad que evaluar todavía.
  if (ny < 1900 || fn > fecha || nm < 1 || nm > 12 || nd < 1 || nd > 31) return null;
  let edad = fy - ny;
  if (fm < nm || (fm === nm && fd < nd)) edad -= 1;
  return edad;
}

/** Curso que corresponde a esa edad (null si no cabe en ninguno). */
export function cursoKidsParaEdad(edad: number | null): string | null {
  if (edad === null) return null;
  return Object.entries(RANGO_EDAD_CURSO).find(([, r]) => edad >= r.min && edad <= r.max)?.[0] ?? null;
}

/** Mensaje de error si la edad no corresponde al curso; null si está bien (o si falta el dato). */
export function errorEdadCursoKids(fechaNacimiento: any, tipoCurso?: string | null): string | null {
  const rango = RANGO_EDAD_CURSO[String(tipoCurso || '').toUpperCase()];
  const edad = edadKidsEnFecha(fechaNacimiento);
  if (!rango || edad === null) return null;
  if (edad >= rango.min && edad <= rango.max) return null;
  const sugerido = cursoKidsParaEdad(edad);
  return `La edad del niño hoy (${edad} años) no corresponde a ${rango.etiqueta}.` +
    (sugerido ? ` Debe inscribirse en ${RANGO_EDAD_CURSO[sugerido].etiqueta}.` : ' No cabe en ningún curso Kids (6–13 años).');
}

function fullName(primer?: string, segundo?: string): string {
  return `${primer || ''} ${segundo || ''}`.trim();
}

/**
 * KIDS rechaza la reserva entera ("La entrada no es válida") si un correo no es
 * válido. Se toma el primer correo bien formado del texto (p. ej.
 * "liamarvera@yahoo.es,hija" → "liamarvera@yahoo.es"); si no hay ninguno, null.
 */
function correoValido(v: unknown): string | null {
  const m = String(v ?? '').match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  return m ? m[0].toLowerCase() : null;
}

const normDoc = (v: unknown) => String(v ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');

/**
 * Apoderado del niño tal como lo espera KIDS — LA regla única (reserva y
 * "Modificar" del apoderado la usan igual):
 *  - mismo documento que el titular ⇒ titular = apoderado (mandarlo como persona
 *    nueva hacía que KIDS la creara dos veces → "Database error");
 *  - titular EMPRESA ⇒ nunca es apoderada: se exige una persona con nombre y
 *    documento propios (si no, lanza con un mensaje claro).
 */
export function apoderadoParaKids(titular: any, kd: any, countryCode: string): {
  titularEsApoderado: boolean;
  apoderado: KidsPersona | null;
  parentesco: string | null;
} {
  const esEmpresa = String(titular.tipoPersona || '').trim() === 'Empresa';
  if (esEmpresa) {
    const doc = normDoc(kd.apoderadoDoc);
    if (!doc || doc === normDoc(titular.numeroId) || !String(kd.apoderado || '').trim()) {
      throw new Error(
        'El titular es una empresa: el apoderado debe ser una persona (p. ej. el representante legal), ' +
        'con su propio nombre y documento — no el RUT de la empresa.');
    }
  }
  const titularEsApoderado = !esEmpresa && (kd.titularEsApoderado === true
    || (!!normDoc(kd.apoderadoDoc) && normDoc(kd.apoderadoDoc) === normDoc(titular.numeroId)));
  if (!titularEsApoderado && (!String(kd.apoderado || '').trim() || !String(kd.apoderadoApellidos || '').trim() || !normDoc(kd.apoderadoDoc))) {
    throw new Error('Faltan nombres, apellidos o documento del apoderado.');
  }
  return {
    titularEsApoderado,
    apoderado: titularEsApoderado ? null : {
      nombres: String(kd.apoderado).trim(),
      apellidos: String(kd.apoderadoApellidos).trim(),
      fechaNacimiento: null,
      docTipo: DOC_TIPO,
      // Tal cual (recortado), como siempre: KIDS identifica a la persona por documento exacto.
      docNumero: String(kd.apoderadoDoc || '').trim(),
      countryCode,
      email: correoValido(kd.apoderadoMail),
      telefono: kd.apoderadoTelefono || null,
    },
    parentesco: kd.parentesco || null,
  };
}

/** Construye el body de POST /api/kids-intake/reservations desde los datos de LGS. */
export function buildKidsReservation(args: {
  externalRef: string;
  countryCode: string;
  inicio: string;         // YYYY-MM-DD
  finalContrato: string;  // YYYY-MM-DD
  titular: any;
  beneficiario: any;      // el niño
  kidsData: any;
}): KidsReservationInput {
  const { externalRef, countryCode, inicio, finalContrato, titular, beneficiario: b, kidsData: kd } = args;

  // Titular EMPRESA: la razón social va en primerNombre y no tiene apellidos.
  // KIDS exige apellidos (persona), así que se rotula "(Empresa)".
  const esEmpresa = String(titular.tipoPersona || '').trim() === 'Empresa';
  const ap = apoderadoParaKids(titular, kd, countryCode);

  const titularPersona: KidsPersona = {
    nombres: fullName(titular.primerNombre, titular.segundoNombre),
    apellidos: fullName(titular.primerApellido, titular.segundoApellido) || (esEmpresa ? '(Empresa)' : '-'),
    fechaNacimiento: toISODate(titular.fechaNacimiento) || null,
    docTipo: DOC_TIPO,
    docNumero: String(titular.numeroId || ''),
    countryCode,
    email: correoValido(titular.email),
    telefono: titular.celular || null,
  };

  const esTitularApoderado = ap.titularEsApoderado;
  const apoderadoNuevo: KidsPersona | undefined = ap.apoderado ?? undefined;

  return {
    externalRef,
    countryCode,
    tipoCurso: kd.tipoCurso,
    inicio,
    finalContrato,
    classroomId: kd.classroomId,
    titular: titularPersona,
    titularEsApoderado: esTitularApoderado,
    apoderadoNuevo,
    nino: {
      nombres: fullName(b.primerNombre, b.segundoNombre),
      apellidos: fullName(b.primerApellido, b.segundoApellido),
      fechaNacimiento: toISODate(b.fechaNacimiento),
      docTipo: DOC_TIPO,
      docNumero: String(b.numeroId || ''),
      countryCode,
      email: correoValido(b.email),
      telefono: b.celular || null,
    },
    parentesco: ap.parentesco,
  };
}
