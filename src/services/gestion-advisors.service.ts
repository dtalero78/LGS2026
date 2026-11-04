/**
 * Administración › Gestión Advisors — configuración (Fase 1).
 *
 *  - Tarifas (TARIFAS_ADVISOR): por país, programa (LGS/KIDS), tipo (POR_HORAS/SEMIPLANTA),
 *    categoría (ESTANDAR, INTERNACIONAL…) y concepto (NORMAL/FESTIVO/EXAM_INTERN), con
 *    vigencia: cambiar una tarifa = fila nueva (se conserva el historial).
 *  - Ficha de pago de cada advisor (columnas de ADVISORS): tipo de contratación, categoría,
 *    programa, grupo de pago, enlace a KIDS, valor fijo y horas de planta/semiplanta.
 *
 * Reglas de negocio completas en docs/specs/gestion-advisors.md.
 */

import 'server-only';
import { query, queryMany, queryOne } from '@/lib/postgres';
import { ValidationError, NotFoundError } from '@/lib/errors';
import { generateId } from '@/lib/id-generator';

export const PAISES_PAGO = ['Chile', 'Colombia', 'Ecuador'] as const;
export const PROGRAMAS = ['LGS', 'KIDS'] as const;
export const PROGRAMAS_ADVISOR = ['LGS', 'KIDS', 'AMBOS'] as const;
export const TIPOS_CONTRATACION = ['POR_HORAS', 'SEMIPLANTA', 'PLANTA'] as const;
export const TIPOS_TARIFA = ['POR_HORAS', 'SEMIPLANTA'] as const; // planta no tiene tarifa por hora
export const CONCEPTOS = ['NORMAL', 'FESTIVO', 'EXAM_INTERN'] as const;
export const MONEDAS = ['COP', 'CLP', 'USD'] as const;

/** Moneda en que se paga a un advisor según su grupo de pago. */
export const MONEDA_POR_PAIS: Record<string, string> = { Chile: 'CLP', Colombia: 'COP', Ecuador: 'USD' };

const num = (v: any): number | null => (v === null || v === undefined || v === '' ? null : Number(v));

function categoriaValida(v: any): string {
  const c = String(v || '').trim().toUpperCase().replace(/\s+/g, '_');
  if (!c) return 'ESTANDAR';
  if (!/^[A-Z0-9_]{2,40}$/.test(c)) throw new ValidationError('La categoría solo admite letras, números y guion bajo (2–40).');
  return c;
}

function enLista<T extends readonly string[]>(v: any, lista: T, campo: string): T[number] {
  const s = String(v ?? '').trim();
  if (!(lista as readonly string[]).includes(s)) throw new ValidationError(`${campo} inválido (${lista.join(', ')}).`);
  return s as T[number];
}

// ── Tarifas ──────────────────────────────────────────────────────────────────

export interface Tarifa {
  _id: string; pais: string; programa: string; tipo: string; categoria: string; concepto: string;
  moneda: string; valor: number; vigenteDesde: string; activo: boolean; creadoPor: string | null;
}

export async function listarTarifas(): Promise<Tarifa[]> {
  const rows = await queryMany<any>(
    `SELECT *, TO_CHAR("vigenteDesde", 'YYYY-MM-DD') AS "vigenteDesdeStr" FROM "TARIFAS_ADVISOR"
      ORDER BY "pais", "programa", "tipo", "categoria", "concepto", "vigenteDesde" DESC`);
  return rows.map((r) => ({
    _id: r._id, pais: r.pais, programa: r.programa, tipo: r.tipo, categoria: r.categoria,
    concepto: r.concepto, moneda: r.moneda, valor: Number(r.valor), vigenteDesde: r.vigenteDesdeStr,
    activo: r.activo !== false, creadoPor: r.creadoPor || null,
  }));
}

/** Crea (sin id) o edita (con id) una tarifa. Para cambiar el valor desde una fecha, crear una nueva. */
export async function guardarTarifa(datos: any, actor: string, id?: string): Promise<string> {
  const pais = enLista(datos?.pais, PAISES_PAGO, 'País');
  const programa = enLista(datos?.programa || 'LGS', PROGRAMAS, 'Programa');
  const tipo = enLista(datos?.tipo, TIPOS_TARIFA, 'Tipo');
  const categoria = categoriaValida(datos?.categoria);
  const concepto = enLista(datos?.concepto, CONCEPTOS, 'Concepto');
  const moneda = enLista(datos?.moneda || MONEDA_POR_PAIS[pais], MONEDAS, 'Moneda');
  const valor = Number(datos?.valor);
  if (!Number.isFinite(valor) || valor < 0) throw new ValidationError('El valor debe ser un número positivo.');
  const vigenteDesde = String(datos?.vigenteDesde || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vigenteDesde)) throw new ValidationError('Vigente desde debe ser una fecha (AAAA-MM-DD).');
  const activo = datos?.activo !== false;

  const dup = await queryOne<{ _id: string }>(
    `SELECT "_id" FROM "TARIFAS_ADVISOR"
      WHERE "pais"=$1 AND "programa"=$2 AND "tipo"=$3 AND "categoria"=$4 AND "concepto"=$5 AND "vigenteDesde"=$6::date AND "_id" <> $7`,
    [pais, programa, tipo, categoria, concepto, vigenteDesde, id || '']);
  if (dup) throw new ValidationError('Ya existe esa tarifa con la misma fecha de vigencia. Edítela o use otra fecha.');

  const vals = [pais, programa, tipo, categoria, concepto, moneda, valor, vigenteDesde, activo];
  if (id) {
    const r = await query(
      `UPDATE "TARIFAS_ADVISOR" SET "pais"=$1,"programa"=$2,"tipo"=$3,"categoria"=$4,"concepto"=$5,"moneda"=$6,
              "valor"=$7,"vigenteDesde"=$8::date,"activo"=$9,"_updatedDate"=NOW() WHERE "_id"=$10 RETURNING "_id"`,
      [...vals, id]);
    if (!r.rowCount) throw new NotFoundError('Tarifa', id);
    console.log(`[gestion-advisors] tarifa ${id} editada por ${actor}: ${JSON.stringify(datos)}`);
    return id;
  }
  const nuevo = generateId('tar');
  await query(
    `INSERT INTO "TARIFAS_ADVISOR" ("_id","pais","programa","tipo","categoria","concepto","moneda","valor","vigenteDesde","activo","creadoPor")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::date,$10,$11)`, [nuevo, ...vals, actor]);
  return nuevo;
}

/**
 * Borra una tarifa (p. ej. cargada por error). Los cortes VERIFICADO/PAGADO no se afectan:
 * guardan su valor en el snapshot; los abiertos se recalculan con la tarifa que quede vigente.
 */
export async function borrarTarifa(id: string, actor: string): Promise<void> {
  const r = await query<any>(`DELETE FROM "TARIFAS_ADVISOR" WHERE "_id"=$1 RETURNING *`, [id]);
  if (!r.rowCount) throw new NotFoundError('Tarifa', id);
  console.log(`[gestion-advisors] tarifa ${id} borrada por ${actor}: ${JSON.stringify(r.rows[0])}`);
}

// ── Ficha de pago de los advisors ────────────────────────────────────────────

export interface AdvisorPago {
  _id: string; nombre: string; email: string | null; pais: string | null; activo: boolean; esPlanta: boolean;
  tipoContratacion: string; categoriaTarifa: string; programa: string; grupoPago: string | null;
  grupoPagoEfectivo: string | null; kidsUserId: string | null;
  valorFijoMensual: number | null; horasContratadas: number | null; horasGestionAdmin: number | null;
}

/** Grupo de pago efectivo: el configurado o, si no hay, el país del advisor. */
export function grupoPagoDe(a: { grupoPago?: string | null; pais?: string | null }): string | null {
  return a.grupoPago || ((PAISES_PAGO as readonly string[]).includes(a.pais || '') ? a.pais! : null);
}

export async function listarAdvisorsPago(opts: { verCompensacion: boolean }): Promise<AdvisorPago[]> {
  const rows = await queryMany<any>(
    `SELECT "_id", COALESCE(NULLIF(TRIM("nombreCompleto"), ''), TRIM(CONCAT("primerNombre", ' ', "primerApellido"))) AS nombre,
            "email", "pais", COALESCE("activo", false) AS activo, COALESCE("esPlanta", false) AS "esPlanta",
            "tipoContratacion", "categoriaTarifa", "programa", "grupoPago", "kidsUserId",
            "valorFijoMensual", "horasContratadas", "horasGestionAdmin"
       FROM "ADVISORS" ORDER BY COALESCE("activo", false) DESC, "pais", nombre`);
  return rows.map((r) => ({
    _id: r._id, nombre: r.nombre || r._id, email: r.email || null, pais: r.pais || null,
    activo: !!r.activo, esPlanta: !!r.esPlanta,
    tipoContratacion: r.tipoContratacion, categoriaTarifa: r.categoriaTarifa, programa: r.programa,
    grupoPago: r.grupoPago || null, grupoPagoEfectivo: grupoPagoDe(r), kidsUserId: r.kidsUserId || null,
    // La compensación (fijos y horas contratadas) solo se expone con VER_COMPENSACION.
    valorFijoMensual: opts.verCompensacion ? num(r.valorFijoMensual) : null,
    horasContratadas: opts.verCompensacion ? num(r.horasContratadas) : null,
    horasGestionAdmin: opts.verCompensacion ? num(r.horasGestionAdmin) : null,
  }));
}

/** Actualiza la ficha de pago de un advisor (solo los campos enviados). */
export async function guardarFichaPago(id: string, datos: any, actor: string) {
  const sets: string[] = [];
  const vals: any[] = [];
  const set = (col: string, v: any) => { vals.push(v); sets.push(`"${col}" = $${vals.length}`); };
  const horas = (v: any, campo: string) => {
    if (v === null || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 744) throw new ValidationError(`${campo}: número de horas inválido.`);
    return n;
  };

  if ('tipoContratacion' in datos) set('tipoContratacion', enLista(datos.tipoContratacion, TIPOS_CONTRATACION, 'Tipo de contratación'));
  if ('categoriaTarifa' in datos) set('categoriaTarifa', categoriaValida(datos.categoriaTarifa));
  if ('programa' in datos) set('programa', enLista(datos.programa, PROGRAMAS_ADVISOR, 'Programa'));
  if ('grupoPago' in datos) set('grupoPago', datos.grupoPago ? enLista(datos.grupoPago, PAISES_PAGO, 'Grupo de pago') : null);
  if ('kidsUserId' in datos) {
    const k = String(datos.kidsUserId || '').trim();
    if (k && !/^[0-9a-f-]{36}$/i.test(k)) throw new ValidationError('El usuario de KIDS debe ser un UUID.');
    set('kidsUserId', k || null);
  }
  if ('valorFijoMensual' in datos) {
    const v = datos.valorFijoMensual === null || datos.valorFijoMensual === '' ? null : Number(datos.valorFijoMensual);
    if (v !== null && (!Number.isFinite(v) || v < 0)) throw new ValidationError('Valor fijo mensual inválido.');
    set('valorFijoMensual', v);
  }
  if ('horasContratadas' in datos) set('horasContratadas', horas(datos.horasContratadas, 'Horas contratadas'));
  if ('horasGestionAdmin' in datos) set('horasGestionAdmin', horas(datos.horasGestionAdmin, 'Horas de gestión administrativa'));
  if (!sets.length) throw new ValidationError('Nada que actualizar.');

  vals.push(id);
  const r = await query(
    `UPDATE "ADVISORS" SET ${sets.join(', ')}, "_updatedDate" = NOW() WHERE "_id" = $${vals.length} RETURNING "_id"`, vals);
  if (!r.rowCount) throw new NotFoundError('Advisor', id);
  await query(
    `INSERT INTO "LIQ_ADVISOR_LOG" ("_id","advisorId","accion","detalle","usuarioEmail") VALUES ($1,$2,'FICHA_PAGO',$3,$4)`,
    [generateId('lql'), id, JSON.stringify(datos), actor]);
}
