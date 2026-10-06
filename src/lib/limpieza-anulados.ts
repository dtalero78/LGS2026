import 'server-only';

/**
 * Reglas de Mantenimiento › Limpieza de Anulados. Se aplican sobre el TITULAR
 * (alias `p`). Nunca un Aprobado ni un PRB-. Dos categorías con pestaña propia:
 *   - anulados:    estado ANULADO o aprobacion Contrato nulo / Devuelto / Rechazado
 *   - retractados: aprobacion Retractado (el cliente se retractó en el plazo legal).
 *     Se listan aparte para decidir si se borran o se conservan como histórico.
 */
export const ANULADO_WHERE = `
  (UPPER(COALESCE(p."estado",'')) = 'ANULADO' OR p."aprobacion" IN ('Contrato nulo','Devuelto','Rechazado'))
  AND COALESCE(p."aprobacion",'') NOT IN ('Aprobado','APROBADA','Retractado')
  AND COALESCE(p."contrato",'') <> '' AND p."contrato" NOT LIKE 'PRB-%'`;

export const RETRACTADO_WHERE = `
  (p."aprobacion" = 'Retractado' OR UPPER(COALESCE(p."estado",'')) = 'RETRACTADO')
  AND COALESCE(p."aprobacion",'') NOT IN ('Aprobado','APROBADA')
  AND COALESCE(p."contrato",'') <> '' AND p."contrato" NOT LIKE 'PRB-%'`;

export type CategoriaLimpieza = 'anulados' | 'retractados';

export const categoriaDe = (v: unknown): CategoriaLimpieza =>
  String(v || '').toLowerCase() === 'retractados' ? 'retractados' : 'anulados';

export const whereCategoria = (c: CategoriaLimpieza) => (c === 'retractados' ? RETRACTADO_WHERE : ANULADO_WHERE);

/** Normalización SQL del documento (igual a normalizeNumeroId). Recibe la columna. */
export const sqlNorm = (col: string) =>
  `UPPER(REGEXP_REPLACE(COALESCE(${col},''), '[.[:space:]_-]', '', 'g'))`;

export const TIPO_PURGA_ANULADOS = 'LIMPIEZA_ANULADOS';
export const TIPO_PURGA_RETRACTADOS = 'LIMPIEZA_RETRACTADOS';
export const TIPOS_PURGA_LIMPIEZA = [TIPO_PURGA_ANULADOS, TIPO_PURGA_RETRACTADOS];
export const tipoPurgaDe = (c: CategoriaLimpieza) => (c === 'retractados' ? TIPO_PURGA_RETRACTADOS : TIPO_PURGA_ANULADOS);
