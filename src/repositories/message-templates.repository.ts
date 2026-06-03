/**
 * Message Templates Repository — CRUD sobre MESSAGE_TEMPLATES.
 *
 * Tabla append-only en el sentido de que el slug es UNIQUE — no se reescribe
 * uno existente accidentalmente. Para desactivar una plantilla, se usa
 * `activo=false` (soft delete) en vez de borrarla físicamente.
 */
import 'server-only';
import { query, queryOne, queryMany } from '@/lib/postgres';

export interface MessageTemplate {
  _id: string;
  slug: string;
  nombre: string;
  descripcion: string | null;
  contenido: string;
  placeholders: string[];
  activo: boolean;
  _owner: string | null;
  _createdDate: string;
  _updatedDate: string;
}

function parseRow(r: any): MessageTemplate {
  return {
    ...r,
    placeholders: Array.isArray(r.placeholders)
      ? r.placeholders
      : (typeof r.placeholders === 'string' ? safeParseArr(r.placeholders) : []),
    activo: r.activo === true,
  };
}

function safeParseArr(s: string): string[] {
  try { const j = JSON.parse(s); return Array.isArray(j) ? j : []; }
  catch { return []; }
}

export const MessageTemplatesRepository = {
  /**
   * Lista todas las plantillas. Default: solo activas (para dropdown del envío).
   * Pasar `includeInactive=true` para la página de gestión.
   */
  async findAll(opts: { includeInactive?: boolean } = {}): Promise<MessageTemplate[]> {
    const where = opts.includeInactive ? '1=1' : '"activo" = true';
    const rows = await queryMany<any>(
      `SELECT * FROM "MESSAGE_TEMPLATES" WHERE ${where} ORDER BY "nombre" ASC`,
    );
    return rows.map(parseRow);
  },

  async findById(id: string): Promise<MessageTemplate | null> {
    const r = await queryOne<any>(`SELECT * FROM "MESSAGE_TEMPLATES" WHERE "_id" = $1`, [id]);
    return r ? parseRow(r) : null;
  },

  async findBySlug(slug: string): Promise<MessageTemplate | null> {
    const r = await queryOne<any>(`SELECT * FROM "MESSAGE_TEMPLATES" WHERE "slug" = $1`, [slug]);
    return r ? parseRow(r) : null;
  },

  async insertOne(input: {
    _id: string;
    slug: string;
    nombre: string;
    descripcion: string | null;
    contenido: string;
    placeholders: string[];
    activo: boolean;
    _owner: string | null;
  }): Promise<MessageTemplate> {
    const r = await queryOne<any>(
      `INSERT INTO "MESSAGE_TEMPLATES"
         ("_id","slug","nombre","descripcion","contenido","placeholders","activo","_owner")
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)
       RETURNING *`,
      [
        input._id, input.slug, input.nombre, input.descripcion,
        input.contenido, JSON.stringify(input.placeholders),
        input.activo, input._owner,
      ],
    );
    return parseRow(r);
  },

  async update(id: string, patch: Partial<{
    nombre: string;
    descripcion: string | null;
    contenido: string;
    placeholders: string[];
    activo: boolean;
  }>): Promise<MessageTemplate | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let i = 1;
    if (patch.nombre !== undefined)       { updates.push(`"nombre" = $${i++}`);       params.push(patch.nombre); }
    if (patch.descripcion !== undefined)  { updates.push(`"descripcion" = $${i++}`);  params.push(patch.descripcion); }
    if (patch.contenido !== undefined)    { updates.push(`"contenido" = $${i++}`);    params.push(patch.contenido); }
    if (patch.placeholders !== undefined) { updates.push(`"placeholders" = $${i++}::jsonb`); params.push(JSON.stringify(patch.placeholders)); }
    if (patch.activo !== undefined)       { updates.push(`"activo" = $${i++}`);       params.push(patch.activo); }
    if (updates.length === 0) return this.findById(id);
    updates.push(`"_updatedDate" = NOW()`);
    params.push(id);
    const r = await queryOne<any>(
      `UPDATE "MESSAGE_TEMPLATES" SET ${updates.join(', ')} WHERE "_id" = $${i} RETURNING *`,
      params,
    );
    return r ? parseRow(r) : null;
  },

  /** Soft delete: marca activo=false. */
  async softDelete(id: string): Promise<MessageTemplate | null> {
    return this.update(id, { activo: false });
  },
};
