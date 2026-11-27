import { NextRequest } from 'next/server';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { hasPermission } from '@/lib/api-permissions';
import { AprobacionPermission, ComercialPermission } from '@/types/permissions';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { queryOne } from '@/lib/postgres';
import { esSinEstado, requisitosFaltantes } from '@/lib/estado-aprobacion';
import { registrarEventoContrato } from '@/lib/contrato-eventos';
import { generarYArchivarContratoPdf } from '@/lib/contract-pdf-generate';
import { previsualizarDepuracion } from '@/lib/libro-depuracion';

/**
 * "Dejar listo para aprobación" (pantalla del contrato, Comercial) — acordado 2026-11-27.
 *
 * NO guarda un estado: el estado sigue siendo el CALCULADO de lib/estado-aprobacion
 * (firma, documentos, recibo, PDF en Drive). Esto es la lista de comprobación + acciones:
 *   - "Enviado" se exige SOLO aquí (no entra en la regla del Libro): cumple si hay registro
 *     del envío del PDF por WhatsApp (CONTRATO_EVENTOS, desde 2026-11-04) o si la firma
 *     fue por OTP (el cliente abrió el enlace y firmó).
 *   - Confirmar = constancia en el Seguimiento (CONTRATO_EVENTOS, FIRMA, ACCION_CONFIRMADO).
 *   - Solo contratos SIN ESTADO; los demás estados los gestiona Aprobación.
 *
 * GET  → { contrato, sinEstado, aprobacion, requisitos[], completo, confirmacion, puedeAnexar, otrosContratos }
 * POST { accion: 'confirmar' | 'generar-pdf' }
 */

const ACCION_CONFIRMADO = 'Contrato dejado listo para aprobación';
const ACCION_ENVIO = 'PDF del contrato enviado por WhatsApp';

async function estado(titularId: string, session: any) {
  const t = await queryOne<any>(
    `SELECT "_id","contrato","tipoUsuario","aprobacion","hashConsentimiento","documentacion","reciboInscripcion",
            "driveFileId","consentimientoDeclarativo"
       FROM "PEOPLE" WHERE "_id" = $1`, [titularId]);
  if (!t || t.tipoUsuario !== 'TITULAR') throw new NotFoundError('Titular', titularId);

  const consent = typeof t.consentimientoDeclarativo === 'string'
    ? (() => { try { return JSON.parse(t.consentimientoDeclarativo); } catch { return null; } })()
    : t.consentimientoDeclarativo;
  const tipoFirma: string | null = String(t.hashConsentimiento || '').trim() ? (consent?.tipoAprobacion || 'FIRMADO') : null;

  const envio = await queryOne<any>(
    `SELECT "_createdDate", "usuarioNombre", "usuarioEmail" FROM "CONTRATO_EVENTOS"
      WHERE "titularId" = $1 AND "accion" = $2 ORDER BY "_createdDate" DESC LIMIT 1`, [titularId, ACCION_ENVIO]).catch(() => null);
  const confirmacion = await queryOne<any>(
    `SELECT "_createdDate", "usuarioNombre", "usuarioEmail" FROM "CONTRATO_EVENTOS"
      WHERE "titularId" = $1 AND "accion" = $2 ORDER BY "_createdDate" DESC LIMIT 1`, [titularId, ACCION_CONFIRMADO]).catch(() => null);

  const falt = requisitosFaltantes(t);
  const enviado = !!envio || tipoFirma === 'OTP';
  const nDocs = Array.isArray(t.documentacion) ? t.documentacion.length : 0;
  const requisitos = [
    { clave: 'FIRMA', label: 'Firmado', ok: !falt.includes('FIRMA'),
      detalle: tipoFirma === 'OTP' ? 'Firma por OTP' : tipoFirma === 'CORREO' ? 'Sí acepto por correo' : tipoFirma ? `Consentimiento (${tipoFirma})` : 'Sin firma' },
    { clave: 'DOCUMENTOS', label: 'Documentos', ok: !falt.includes('DOCUMENTOS'),
      detalle: nDocs ? `${nDocs} documento(s)` : 'Sin documentos' },
    { clave: 'RECIBO', label: 'Recibo de inscripción', ok: !falt.includes('RECIBO'),
      detalle: t.reciboInscripcion ? 'Subido' : 'Sin recibo' },
    { clave: 'DRIVE', label: 'PDF generado (Drive)', ok: !falt.includes('DRIVE'),
      detalle: t.driveFileId ? 'Archivado en Drive' : 'Sin PDF en Drive' },
    { clave: 'ENVIADO', label: 'PDF enviado al titular', ok: enviado,
      detalle: envio ? `Enviado el ${new Date(envio._createdDate).toISOString()}` : tipoFirma === 'OTP' ? 'Firmó por OTP (recibió el enlace)' : 'Sin registro de envío' },
  ];

  const puedeAnexar = await hasPermission(session, ComercialPermission.ANEXAR_SI_ACEPTO as any)
    || await hasPermission(session, AprobacionPermission.LIBRO_PRODUCCION_RATIFICAR as any);
  const sinEstado = esSinEstado(t.aprobacion);
  // Otros contratos del titular (aviso al anexar el Sí acepto, como en el Libro).
  const otrosContratos = !tipoFirma && sinEstado ? (await previsualizarDepuracion(titularId)).otrosContratos : [];

  return {
    contrato: t.contrato, aprobacion: t.aprobacion || null, sinEstado,
    requisitos, completo: requisitos.every(r => r.ok),
    envio: envio ? { fecha: envio._createdDate, por: envio.usuarioNombre || envio.usuarioEmail } : null,
    confirmacion: confirmacion ? { fecha: confirmacion._createdDate, por: confirmacion.usuarioNombre || confirmacion.usuarioEmail } : null,
    puedeAnexar, otrosContratos,
  };
}

export const GET = handlerWithStaffAuth(async (_req: NextRequest, { params }, session) => {
  return successResponse(await estado(params.id, session));
});

export const POST = handlerWithStaffAuth(async (req: NextRequest, { params }, session) => {
  const { accion } = await req.json().catch(() => ({}));
  const titularId = params.id;

  if (accion === 'generar-pdf') {
    const e0 = await estado(titularId, session);
    if (!e0.sinEstado) throw new ValidationError(`El contrato tiene estado "${e0.aprobacion}": lo gestiona Aprobación.`);
    await generarYArchivarContratoPdf(titularId);
    await registrarEventoContrato({
      personaId: titularId, categoria: 'DOCUMENTOS', accion: 'PDF del contrato generado',
      detalle: 'Desde "Dejar listo para aprobación"', session,
    });
    return successResponse(await estado(titularId, session));
  }

  if (accion === 'confirmar') {
    const e = await estado(titularId, session);
    if (!e.sinEstado) throw new ValidationError(`El contrato tiene estado "${e.aprobacion}": lo gestiona Aprobación.`);
    const faltan = e.requisitos.filter(r => !r.ok).map(r => r.label);
    if (faltan.length) throw new ValidationError(`Aún falta: ${faltan.join(', ')}`);
    await registrarEventoContrato({
      personaId: titularId, categoria: 'APROBACION', accion: ACCION_CONFIRMADO,
      detalle: `Comprobado: ${e.requisitos.map(r => `${r.label} (${r.detalle})`).join(' · ')}`,
      session, estricto: true,
    });
    return successResponse(await estado(titularId, session));
  }

  throw new ValidationError('Acción no válida');
});
