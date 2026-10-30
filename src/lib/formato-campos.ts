/**
 * Regla única de FORMATO de los datos de personas (client-safe).
 *
 * Se aplica en el servidor antes de guardar (Crear Contrato, edición del contrato,
 * Agregar beneficiario, ficha, carga por lote, Cargar beneficiarios, perfil del
 * estudiante, apoderado Kids) y en Crear Contrato al avanzar de paso, para que el
 * comercial vea cómo queda. Así los datos quedan iguales aunque se digiten distinto.
 * Los teléfonos tienen su propia regla (lib/telefono) y el documento la suya (numeroId).
 *
 *   Nombres, apellidos, ciudad, referencias, representante, apoderado → Nombre Propio
 *   Email → minúsculas, sin espacios
 *   Parentesco, cargo, género → Primera letra en mayúscula
 *   Dirección, rubro → espacios limpios + primera letra en mayúscula (resto como viene)
 *   Razón social / empresa → solo espacios limpios (respeta S.A.S., SpA…)
 */

/** Partículas que van en minúscula dentro de un nombre (salvo al inicio). */
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'da', 'das', 'do', 'dos', 'di', 'van', 'von', 'der']);

/** Quita espacios al inicio/fin y colapsa los repetidos. */
export function limpiarTexto(v: string): string {
  return v.replace(/\s+/g, ' ').trim();
}

/** Mayúscula en la primera LETRA (salta signos iniciales: ",martínez" → ",Martínez"). */
const capitalizar = (w: string) => {
  for (let i = 0; i < w.length; i++) {
    const ch = w.charAt(i);
    if (ch.toLocaleLowerCase('es') !== ch.toLocaleUpperCase('es')) return w.slice(0, i) + ch.toLocaleUpperCase('es') + w.slice(i + 1);
  }
  return w;
};

/** "MARÍA DE LOS ÁNGELES o'neil-pérez" → "María de los Ángeles O'Neil-Pérez". */
export function nombrePropio(v: string): string {
  const palabras = limpiarTexto(v).toLocaleLowerCase('es').split(' ');
  return palabras
    .map((w, i) => (i > 0 && PARTICULAS.has(w))
      ? w
      // Mayúscula tras guion y tras apóstrofo, recto o tipográfico: O'Neil, O’Brien.
      : w.split(/([-'’])/).map(capitalizar).join(''))
    .join(' ');
}

/** "Juan.Perez@GMAIL.com " → "juan.perez@gmail.com". */
export function formatoEmail(v: string): string {
  return v.replace(/\s+/g, '').toLowerCase();
}

/** "MAMÁ" → "Mamá". */
export function primeraMayuscula(v: string): string {
  return capitalizar(limpiarTexto(v).toLocaleLowerCase('es'));
}

/** "av  providencia 123" → "Av providencia 123" (no baja el resto: respeta "Depto 4B"). */
export function primeraMayusculaSinBajar(v: string): string {
  return capitalizar(limpiarTexto(v));
}

type Regla = (v: string) => string;

/** Campos de PEOPLE (y del formulario de contrato) y su regla. */
const REGLAS_PERSONA: Record<string, Regla> = {
  primerNombre: nombrePropio,
  segundoNombre: nombrePropio,
  primerApellido: nombrePropio,
  segundoApellido: nombrePropio,
  ciudad: nombrePropio,
  referenciaUno: nombrePropio,
  referenciaDos: nombrePropio,
  replegal: nombrePropio,
  asesorCreadorContrato: nombrePropio,
  email: formatoEmail,
  parentezcoRefUno: primeraMayuscula,
  parentezcoRefDos: primeraMayuscula,
  replegalcargo: primeraMayuscula,
  cargo: primeraMayuscula,
  genero: primeraMayuscula,
  domicilio: primeraMayusculaSinBajar,
  rubro: primeraMayusculaSinBajar,
  empresa: limpiarTexto,
};

/** Datos del apoderado de un beneficiario Kids (KidsData). */
const REGLAS_APODERADO: Record<string, Regla> = {
  apoderado: nombrePropio,
  apoderadoApellidos: nombrePropio,
  apoderadoMail: formatoEmail,
  parentesco: primeraMayuscula,
};

function aplicar<T extends Record<string, any>>(obj: T, reglas: Record<string, Regla>): T {
  if (!obj || typeof obj !== 'object') return obj;
  const out: any = { ...obj };
  for (const [campo, regla] of Object.entries(reglas)) {
    if (typeof out[campo] === 'string') out[campo] = regla(out[campo]);
  }
  return out;
}

/**
 * Devuelve una copia de la persona con el formato aplicado. Solo toca los campos que
 * vienen como texto (undefined / null quedan igual, sirve para PATCH parciales).
 * `empresa: true` → titular Empresa: `primerNombre` es la RAZÓN SOCIAL y solo se limpia.
 */
export function formatearPersona<T extends Record<string, any>>(p: T, opts: { empresa?: boolean } = {}): T {
  const out: any = aplicar(p, REGLAS_PERSONA);
  if (opts.empresa && typeof p?.primerNombre === 'string') out.primerNombre = limpiarTexto(p.primerNombre);
  if (out?.kidsData && typeof out.kidsData === 'object') out.kidsData = aplicar(out.kidsData, REGLAS_APODERADO);
  return out;
}

/**
 * Para EDICIONES (PATCH/PUT): formatea solo los campos que de verdad cambian respecto
 * al registro guardado. Un valor reenviado igual (p. ej. un nombre antiguo en
 * MAYÚSCULAS que nadie tocó) se deja como está, para que no cuente como "cambio de
 * nombre" (permiso propio + reescritura de las clases).
 */
export function formatearCambios<T extends Record<string, any>>(cambios: T, actual: Record<string, any> | null | undefined, opts: { empresa?: boolean } = {}): T {
  if (!cambios || typeof cambios !== 'object') return cambios;
  const formateado: any = formatearPersona(cambios, opts);
  const out: any = { ...cambios };
  for (const campo of Object.keys(REGLAS_PERSONA)) {
    if (typeof cambios[campo] === 'string' && cambios[campo] !== (actual?.[campo] ?? null)) out[campo] = formateado[campo];
  }
  if (formateado.kidsData) out.kidsData = formateado.kidsData;
  return out;
}

/** Formato de los datos de un apoderado Kids sueltos. */
export function formatearApoderado<T extends Record<string, any>>(kd: T): T {
  return aplicar(kd, REGLAS_APODERADO);
}
