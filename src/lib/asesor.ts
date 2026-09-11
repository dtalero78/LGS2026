import 'server-only';
import { queryOne } from '@/lib/postgres';

/**
 * Resuelve los datos del ejecutivo comercial (asesor) que creó el contrato.
 *
 * Modelo de datos:
 *   - `PEOPLE.asesor`                → EMAIL del comercial (la llave de lookup)
 *   - `PEOPLE.asesorCreadorContrato` → NOMBRE del comercial
 *
 * El nombre se toma, en orden: `asesorCreadorContrato` → lookup en
 * USUARIOS_ROLES por email → el propio valor de `asesor`.
 *
 * DATO HISTÓRICO: hay contratos viejos donde `asesor` guarda un NOMBRE en vez
 * del email (el form tenía una sola casilla mal mapeada). En esos casos NO se
 * inventa un correo: `email` queda vacío y el contrato muestra solo el nombre,
 * en lugar de repetir el nombre en la línea del correo.
 *
 * Devuelve null solo si no hay ni nombre ni email.
 */
export interface AsesorInfo {
  nombre: string;
  email: string;
}

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

export async function getAsesorInfo(
  asesor: string | null | undefined,
  nombreCreador?: string | null,
): Promise<AsesorInfo | null> {
  const raw = (asesor ?? '').trim();
  const nombreDirecto = (nombreCreador ?? '').trim();

  // `asesor` no es un email (dato legacy: guarda el nombre) → sin correo.
  if (!isEmail(raw)) {
    const nombre = nombreDirecto || raw;
    return nombre ? { nombre, email: '' } : null;
  }

  // `asesor` es un email → lo usamos como correo y resolvemos el nombre.
  try {
    const row = await queryOne<{ nombre: string | null; apellido: string | null; email: string }>(
      `SELECT "nombre", "apellido", "email"
         FROM "USUARIOS_ROLES"
        WHERE LOWER(TRIM("email")) = LOWER(TRIM($1))
        LIMIT 1`,
      [raw],
    );
    const nombreLookup = row ? [row.nombre, row.apellido].filter(Boolean).join(' ').trim() : '';
    return { nombre: nombreDirecto || nombreLookup || raw, email: row?.email || raw };
  } catch {
    return { nombre: nombreDirecto || raw, email: raw };
  }
}
