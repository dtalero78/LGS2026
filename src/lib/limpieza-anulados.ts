import 'server-only';

/**
 * Regla de "contrato ANULADO" para Mantenimiento › Limpieza de Anulados.
 * Se aplica sobre el TITULAR (alias `p`): estado ANULADO o aprobacion
 * Contrato nulo / Devuelto / Rechazado. Nunca un Aprobado ni un PRB-.
 */
export const ANULADO_WHERE = `
  (UPPER(COALESCE(p."estado",'')) = 'ANULADO' OR p."aprobacion" IN ('Contrato nulo','Devuelto','Rechazado'))
  AND COALESCE(p."aprobacion",'') NOT IN ('Aprobado','APROBADA')
  AND COALESCE(p."contrato",'') <> '' AND p."contrato" NOT LIKE 'PRB-%'`;

/** Normalización SQL del documento (igual a normalizeNumeroId). Recibe la columna. */
export const sqlNorm = (col: string) =>
  `UPPER(REGEXP_REPLACE(COALESCE(${col},''), '[.[:space:]_-]', '', 'g'))`;

export const TIPO_PURGA_ANULADOS = 'LIMPIEZA_ANULADOS';
