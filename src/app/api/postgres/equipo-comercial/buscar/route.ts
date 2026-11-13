import { NextRequest } from 'next/server';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { queryOne } from '@/lib/postgres';

/**
 * GET /api/postgres/equipo-comercial/buscar?plataforma=Chile&correo=x@y.com
 * Para Crear Contrato (paso 1): busca al ejecutivo comercial en el equipo cargado
 * desde el CRM (EQUIPO_COMERCIAL) por su correo y comprueba que sea del país elegido.
 * Respuesta: { encontrado, nombre, filial, plataforma }.
 * `encontrado` = existe el correo, activo, y su plataforma es la del contrato (o no
 * tiene plataforma registrada). Solo lectura. Gate: staff.
 */
export const GET = handlerWithStaffAuth(async (req: NextRequest) => {
  const sp = new URL(req.url).searchParams;
  const plataforma = (sp.get('plataforma') || '').trim().toLowerCase();
  const correo = (sp.get('correo') || '').trim().toLowerCase();
  if (!correo) return successResponse({ encontrado: false, nombre: null, filial: null, plataforma: null });

  const eq = await queryOne<any>(
    `SELECT "nombre", "filial", "plataforma", "activo",
            "fullExecutive", "jefeGrupo", "gerente", "gerenteDivision", "salesManager"
       FROM "EQUIPO_COMERCIAL"
      WHERE LOWER(TRIM("correo")) = $1 LIMIT 1`, [correo]);

  const plataformaEq = (eq?.plataforma || '').trim();
  const delPais = !!eq && eq.activo !== false &&
    (!plataforma || !plataformaEq || plataformaEq.toLowerCase() === plataforma);
  // El nombre de respaldo que escribe el alta automática no es un nombre real.
  const nombre = (eq?.nombre || '').trim();
  const nombreReal = nombre && nombre !== 'Nombre Comercial' ? nombre : null;

  return successResponse({
    encontrado: delPais && !!nombreReal,
    nombre: delPais ? nombreReal : null,
    filial: delPais ? (eq?.filial || '').trim() || null : null,
    plataforma: plataformaEq || null,
    // Escala vigente que dejó el último contrato creado desde el CRM (null si aún no hay).
    escala: delPais && eq && [eq.fullExecutive, eq.jefeGrupo, eq.gerente, eq.gerenteDivision, eq.salesManager].some(Boolean)
      ? {
          fullExecutive: eq.fullExecutive || null, jefeGrupo: eq.jefeGrupo || null, gerente: eq.gerente || null,
          gerenteDivision: eq.gerenteDivision || null, salesManager: eq.salesManager || null,
        }
      : null,
  });
});
