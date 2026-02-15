/**
 * Roles Repository
 *
 * All SQL for ROL_PERMISOS and USUARIOS_ROLES tables.
 */

import 'server-only';
import { query, queryOne, queryMany, parseJsonbFields } from '@/lib/postgres';
import { BaseRepository } from './base.repository';

// ── ROL_PERMISOS ──

class RolPermisosRepositoryClass extends BaseRepository {
  constructor() {
    super('ROL_PERMISOS', ['permisos']);
  }

  async findByRol(rol: string) {
    const row = await queryOne(
      `SELECT "rol", "permisos", "descripcion", "activo"
       FROM "ROL_PERMISOS"
       WHERE "rol" = $1`,
      [rol]
    );
    return this.parse(row);
  }

  async findAll(activeOnly?: boolean) {
    const whereClause = activeOnly ? 'WHERE "activo" = true' : '';
    const rows = await queryMany(
      `SELECT * FROM "ROL_PERMISOS" ${whereClause} ORDER BY "rol"`
    );
    return this.parseMany(rows);
  }

  async create(rol: string, permisos: string[], descripcion: string, activo: boolean = true) {
    const row = await queryOne(
      `INSERT INTO "ROL_PERMISOS" ("rol", "permisos", "descripcion", "activo", "_createdDate", "_updatedDate")
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING *`,
      [rol, JSON.stringify(permisos), descripcion, activo]
    );
    return this.parse(row);
  }

  async updatePermisos(rol: string, permisos: string[], descripcion?: string) {
    const updates = [`"permisos" = $1`, `"_updatedDate" = NOW()`];
    const params: any[] = [JSON.stringify(permisos)];
    let idx = 2;

    if (descripcion !== undefined) {
      updates.push(`"descripcion" = $${idx++}`);
      params.push(descripcion);
    }

    params.push(rol);

    const row = await queryOne(
      `UPDATE "ROL_PERMISOS"
       SET ${updates.join(', ')}
       WHERE "rol" = $${idx}
       RETURNING *`,
      params
    );
    return this.parse(row);
  }
}

// ── USUARIOS_ROLES ──

class UsuariosRolesRepositoryClass extends BaseRepository {
  constructor() {
    super('USUARIOS_ROLES');
  }

  async findByEmail(email: string) {
    return queryOne(
      `SELECT "email", "rol", "activo", "_createdDate", "_updatedDate"
       FROM "USUARIOS_ROLES"
       WHERE "email" = $1`,
      [email]
    );
  }

  async updateRol(email: string, rol: string) {
    return queryOne(
      `UPDATE "USUARIOS_ROLES"
       SET "rol" = $1, "_updatedDate" = NOW()
       WHERE "email" = $2
       RETURNING *`,
      [rol, email]
    );
  }
}

export const RolPermisosRepository = new RolPermisosRepositoryClass();
export const UsuariosRolesRepository = new UsuariosRolesRepositoryClass();
