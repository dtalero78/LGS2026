import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { query, queryOne } from '@/lib/postgres';
import { ValidationError, NotFoundError } from '@/lib/errors';

/**
 * POST /api/postgres/panel-estudiante/update-profile
 *
 * Student profile update — reusable for ESTUDIANTE role.
 * Updates: email, password, celular, domicilio, ciudad, fechaNacimiento, foto.
 * Sets USUARIOS_ROLES.perfilActualizado = NOW() to stop showing the screen.
 *
 * Tables updated:
 *  - USUARIOS_ROLES: email, password, celular, perfilActualizado
 *  - PEOPLE:         email, celular, domicilio, ciudad, fechaNacimiento, edad
 *  - ACADEMICA:      email, celular, foto, fechaNacimiento, edad
 */
export const POST = handlerWithAuth(async (request, _ctx, session) => {
  const sessionEmail = session.user?.email;
  if (!sessionEmail) throw new ValidationError('No se encontró email en la sesión');

  const body = await request.json();
  const { email, password, celular, domicilio, ciudad, fechaNacimiento, fotoUrl, detallesPersonales, hobbies } = body;

  if (!email?.trim()) throw new ValidationError('El email es requerido');

  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail))
    throw new ValidationError('Formato de email inválido');

  if (password?.trim() && /\s/.test(password))
    throw new ValidationError('La contraseña no puede contener espacios');

  if (celular?.trim() && !/^\d+$/.test(celular.trim()))
    throw new ValidationError('El celular solo debe contener números');

  // Calculate edad from fechaNacimiento
  let edad: number | null = null;
  if (fechaNacimiento) {
    const birth = new Date(fechaNacimiento);
    const today = new Date();
    edad = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) edad--;
  }

  // Get USUARIOS_ROLES record
  const userRole = await queryOne<{ _id: string }>(
    `SELECT "_id" FROM "USUARIOS_ROLES" WHERE LOWER("email") = LOWER($1) LIMIT 1`,
    [sessionEmail]
  );
  if (!userRole) throw new NotFoundError('Usuario', sessionEmail);

  // Build USUARIOS_ROLES update
  const urFields: string[] = [
    `"email" = $2`,
    `"perfilActualizado" = NOW()`,
    `"_updatedDate" = NOW()`,
  ];
  const urValues: any[] = [userRole._id, normalizedEmail];
  let idx = 3;

  if (password?.trim()) {
    urFields.push(`"password" = $${idx++}`);
    urValues.push(password.trim());
  }
  if (celular?.trim()) {
    urFields.push(`"celular" = $${idx++}`);
    urValues.push(celular.trim());
  }

  await query(
    `UPDATE "USUARIOS_ROLES" SET ${urFields.join(', ')} WHERE "_id" = $1`,
    urValues
  );

  // Update PEOPLE by matching old session email
  const peopleFields: string[] = [`"email" = $2`, `"_updatedDate" = NOW()`];
  const peopleValues: any[] = [sessionEmail, normalizedEmail];
  let pidx = 3;

  if (celular?.trim())      { peopleFields.push(`"celular" = $${pidx++}`);       peopleValues.push(celular.trim()); }
  if (domicilio?.trim())    { peopleFields.push(`"domicilio" = $${pidx++}`);     peopleValues.push(domicilio.trim()); }
  if (ciudad?.trim())       { peopleFields.push(`"ciudad" = $${pidx++}`);        peopleValues.push(ciudad.trim()); }
  if (fechaNacimiento)      { peopleFields.push(`"fechaNacimiento" = $${pidx++}::date`); peopleValues.push(fechaNacimiento); }
  if (edad !== null)        { peopleFields.push(`"edad" = $${pidx++}`);          peopleValues.push(edad); }

  await query(
    `UPDATE "PEOPLE" SET ${peopleFields.join(', ')} WHERE LOWER("email") = LOWER($1)`,
    peopleValues
  ).catch(() => {});

  // Update ACADEMICA by matching old session email
  const acadFields: string[] = [`"email" = $2`, `"_updatedDate" = NOW()`];
  const acadValues: any[] = [sessionEmail, normalizedEmail];
  let aidx = 3;

  if (celular?.trim())            { acadFields.push(`"celular" = $${aidx++}`);              acadValues.push(celular.trim()); }
  if (fotoUrl?.trim())            { acadFields.push(`"foto" = $${aidx++}`);                 acadValues.push(fotoUrl.trim()); }
  if (fechaNacimiento)            { acadFields.push(`"fechaNacimiento" = $${aidx++}::date`); acadValues.push(fechaNacimiento); }
  if (edad !== null)              { acadFields.push(`"edad" = $${aidx++}`);                  acadValues.push(edad); }
  if (password?.trim())           { acadFields.push(`"clave" = $${aidx++}`);                acadValues.push(password.trim()); }
  if (detallesPersonales?.trim()) { acadFields.push(`"detallesPersonales" = $${aidx++}`);   acadValues.push(detallesPersonales.trim()); }
  if (hobbies?.trim())            { acadFields.push(`"hobbies" = $${aidx++}`);              acadValues.push(hobbies.trim()); }

  await query(
    `UPDATE "ACADEMICA" SET ${acadFields.join(', ')} WHERE LOWER("email") = LOWER($1)`,
    acadValues
  ).catch(() => {});

  return successResponse({ message: 'Perfil actualizado exitosamente' });
});
