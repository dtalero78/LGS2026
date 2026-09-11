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

function fullName(primer?: string, segundo?: string): string {
  return `${primer || ''} ${segundo || ''}`.trim();
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

  const titularPersona: KidsPersona = {
    nombres: fullName(titular.primerNombre, titular.segundoNombre),
    apellidos: fullName(titular.primerApellido, titular.segundoApellido),
    fechaNacimiento: toISODate(titular.fechaNacimiento) || null,
    docTipo: DOC_TIPO,
    docNumero: String(titular.numeroId || ''),
    countryCode,
    email: titular.email || null,
    telefono: titular.celular || null,
  };

  const esTitularApoderado = kd.titularEsApoderado === true;
  const apoderadoNuevo: KidsPersona | undefined = esTitularApoderado ? undefined : {
    nombres: kd.apoderado || '',
    apellidos: kd.apoderadoApellidos || '',
    fechaNacimiento: null,
    docTipo: DOC_TIPO,
    docNumero: String(kd.apoderadoDoc || ''),
    countryCode,
    email: kd.apoderadoMail || null,
    telefono: kd.apoderadoTelefono || null,
  };

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
      email: b.email || null,
      telefono: b.celular || null,
    },
    parentesco: kd.parentesco || null,
  };
}
