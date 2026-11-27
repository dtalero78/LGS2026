import 'server-only';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { ComercialPermission } from '@/types/permissions';
import { queryOne, withTransaction } from '@/lib/postgres';
import { NotFoundError, ValidationError, ConflictError } from '@/lib/errors';
import { actualizarPersona } from '@/lib/actualizar-persona';
import { verificarDocumento } from '@/lib/verificacion-documento';
import { registrarEventoContrato } from '@/lib/contrato-eventos';
import { formatearPersona } from '@/lib/formato-campos';
import { normalizarTelefono } from '@/lib/telefono';
import { assertNoEsContratoPrueba } from '@/lib/contrato-prueba-guard';
import { toggleStatus } from '@/services/student.service';
import { ids } from '@/lib/id-generator';
import { regenerarPdfTrasCambio } from '@/lib/regenerar-pdf-cambio';

/**
 * POST /api/postgres/matriculas/[id]/editar   ([id] = PEOPLE._id de la persona)
 *
 * Botón "Editar" del Resumen de Matrícula (diseño acordado 2026-11-26):
 *
 *  modo 'corregir'  (COMERCIAL.MATRICULAS.CORREGIR) — misma persona, datos mal
 *     escritos. Solo los campos que cambian, vía actualizarPersona() (la lógica del
 *     PATCH de people: propaga a ACADEMICA / login / bookings / FINANCIEROS).
 *     Nombre y documento exigen además PERSON.INFO.EDITAR_NOMBRE / EDITAR_NUMERO_ID.
 *     Conserva la firma; si se toca la identidad de un contrato firmado queda la
 *     marca "Datos corregidos después de la firma" (CONTRATO_EVENTOS).
 *
 *  modo 'reemplazar' (COMERCIAL.MATRICULAS.REEMPLAZAR, motivo ≥10) — otra persona:
 *     - Titular: solo contrato SIN aprobar (aprobado = "reemplazo de contrato",
 *       otra opción). Se sobrescribe el mismo registro.
 *     - Beneficiario sin aprobar: se sobrescribe el mismo registro.
 *     - Beneficiario aprobado: se crea el nuevo (SIN APROBAR, mismo contrato) y el
 *       anterior se INACTIVA (toggleStatus) y queda como histórico.
 *     Reemplazar al TITULAR anula la firma (hay que solicitarla de nuevo). Reemplazar un
 *     beneficiario conserva la firma (2026-11-27). En todos los reemplazos se vuelve a
 *     generar el PDF del contrato y se archiva en el Drive (lib/regenerar-pdf-cambio);
 *     pagos, financieros, documentación y referencias se conservan. NO se propaga a
 *     las tablas de la persona anterior: su ficha académica sin clases se borra
 *     (como al eliminar un beneficiario) y si ya tiene clases se bloquea.
 *
 *  Kids: no se editan aquí (se sincronizan con KIDS2026): "gestiónelo desde la ficha".
 *
 *  Documento nuevo: misma verificación que Crear Contrato. Bloquea si es
 *  beneficiario de otro contrato aprobado y vivo; si aparece en otro contrato
 *  pendiente o como titular devuelve `requiereConfirmacion` + avisos, y se
 *  reintenta con `confirmarAvisos: true`.
 */

const CAMPOS_IDENTIDAD = ['primerNombre', 'segundoNombre', 'primerApellido', 'segundoApellido', 'numeroId', 'fechaNacimiento', 'genero'];
const CAMPOS_CONTACTO = ['celular', 'telefono', 'email', 'domicilio', 'ciudad'];
const CAMPOS_LABORAL = ['cargo', 'empresa', 'ingresos'];
const GENEROS = ['Masculino', 'Femenino', 'Otro'];

const txt = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
const fechaISO = (v: unknown): string => {
  if (!v) return '';
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10);
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return d ? `${d[3]}-${d[2]}-${d[1]}` : '';
};
const normDoc = (v: unknown) => txt(v).toUpperCase().replace(/[^0-9A-Z]/g, '');
const nombreDe = (p: any) => [p?.primerNombre, p?.segundoNombre, p?.primerApellido, p?.segundoApellido].filter(Boolean).join(' ').trim();

export const POST = handlerWithStaffAuth(async (request, { params }, session) => {
  const body = await request.json().catch(() => ({}));
  const modo = body.modo === 'reemplazar' ? 'reemplazar' : body.modo === 'corregir' ? 'corregir' : null;
  if (!modo) throw new ValidationError('modo debe ser "corregir" o "reemplazar"');
  await requirePermission(session, modo === 'corregir' ? ComercialPermission.MATRICULAS_CORREGIR : ComercialPermission.MATRICULAS_REEMPLAZAR);

  const persona = await queryOne<any>(`SELECT * FROM "PEOPLE" WHERE "_id" = $1`, [params.id]);
  if (!persona) throw new NotFoundError('Persona', params.id);
  if (!persona.contrato) throw new ValidationError('La persona no tiene contrato');
  assertNoEsContratoPrueba(persona.contrato, 'editar la matrícula');
  if (persona.kids === true) {
    throw new ValidationError('Los beneficiarios Kids se sincronizan con KIDS: gestiónelo desde su ficha.');
  }
  const esTitular = persona.tipoUsuario === 'TITULAR';
  const titular = esTitular ? persona : await queryOne<any>(
    `SELECT * FROM "PEOPLE" WHERE "contrato" = $1 AND "tipoUsuario" = 'TITULAR' ORDER BY "_createdDate" ASC LIMIT 1`,
    [persona.contrato]);
  if (!titular) throw new NotFoundError('Titular del contrato', persona.contrato);
  const firmado = txt(titular.hashConsentimiento) !== '';

  // ── Datos recibidos: solo los campos permitidos según el tipo de persona ──
  const permitidos = [...CAMPOS_IDENTIDAD, ...CAMPOS_CONTACTO, ...(esTitular ? CAMPOS_LABORAL : [])];
  const datos: Record<string, any> = {};
  for (const k of permitidos) {
    if (body.datos && Object.prototype.hasOwnProperty.call(body.datos, k)) datos[k] = body.datos[k];
  }
  if (datos.numeroId !== undefined) datos.numeroId = normDoc(datos.numeroId);
  if (datos.fechaNacimiento !== undefined) datos.fechaNacimiento = fechaISO(datos.fechaNacimiento) || null;
  if (datos.genero !== undefined && txt(datos.genero) && !GENEROS.some(g => g.toLowerCase() === txt(datos.genero).toLowerCase())) {
    throw new ValidationError(`Género debe ser: ${GENEROS.join(', ')}`);
  }

  // ── Verificación del documento nuevo (misma matriz de Crear Contrato) ──
  const verificarDoc = async (doc: string) => {
    if (!doc) throw new ValidationError('El número de documento es obligatorio');
    // Dentro del mismo contrato: no puede repetirse entre beneficiarios.
    if (!esTitular) {
      const dup = await queryOne<any>(
        `SELECT "primerNombre","primerApellido" FROM "PEOPLE"
          WHERE "contrato" = $1 AND "tipoUsuario" = 'BENEFICIARIO' AND "_id" <> $2
            AND UPPER(REGEXP_REPLACE(COALESCE("numeroId",''), '[^0-9A-Za-z]', '', 'g')) = $3
            AND COALESCE("estadoInactivo", false) = false LIMIT 1`,
        [persona.contrato, persona._id, doc]);
      if (dup) throw new ConflictError(`El documento ${doc} ya es beneficiario de este contrato (${nombreDe(dup)}).`);
    }
    const registros = await verificarDocumento(doc, persona.contrato);
    const bloqueo = registros.find(r => r.tipoUsuario !== 'TITULAR' && r.situacion === 'APROBADO');
    if (bloqueo) {
      throw new ConflictError(
        `El documento ${doc} ya es beneficiario de ${bloqueo.nombre || 'otra persona'} en el contrato aprobado ${bloqueo.contrato}.`);
    }
    const avisos = registros.map(r => ({
      contrato: r.contrato, nombre: r.nombre, rol: r.tipoUsuario, situacion: r.situacion,
      titularId: r.titularId,
    }));
    return avisos;
  };

  // ════════════════════════ CORREGIR ════════════════════════
  if (modo === 'corregir') {
    // Solo lo que de verdad cambia (un nombre reenviado igual no pide permiso de nombre).
    const cambios: Record<string, any> = {};
    for (const [k, v] of Object.entries(datos)) {
      const antes = k === 'fechaNacimiento' ? fechaISO(persona[k]) : k === 'numeroId' ? normDoc(persona[k]) : txt(persona[k]);
      const nuevo = k === 'fechaNacimiento' ? fechaISO(v) : txt(v);
      if (antes !== nuevo) cambios[k] = nuevo === '' ? null : v;
    }
    if (!Object.keys(cambios).length) throw new ValidationError('No hay cambios que guardar');
    for (const k of ['primerNombre', 'primerApellido', 'numeroId']) {
      if (k in cambios && !txt(cambios[k])) throw new ValidationError(`${k} no puede quedar vacío`);
    }
    if (cambios.numeroId) {
      const avisos = await verificarDoc(cambios.numeroId);
      if (avisos.length && body.confirmarAvisos !== true) {
        return successResponse({ requiereConfirmacion: true, avisos });
      }
    }

    const res = await actualizarPersona(persona._id, cambios, session, {
      accionSeguimiento: 'Corrección desde Resumen',
      datosSeguimiento: { etiqueta: 'Corrección desde Resumen' },
    });

    const identidadTocada = Object.keys(cambios).some(k => CAMPOS_IDENTIDAD.includes(k));
    if (firmado && identidadTocada) {
      await registrarEventoContrato({
        personaId: persona._id, categoria: 'FIRMA', accion: 'Datos corregidos después de la firma',
        detalle: Object.keys(cambios).filter(k => CAMPOS_IDENTIDAD.includes(k)).join(', '), session,
      });
    }
    return successResponse({ ok: true, modo, person: res.person, corregidoTrasFirma: firmado && identidadTocada });
  }

  // ════════════════════════ REEMPLAZAR ════════════════════════
  const motivo = txt(body.motivo);
  if (motivo.length < 10) throw new ValidationError('Indica el motivo del reemplazo (mínimo 10 caracteres).');
  const aprobadoTitular = txt(titular.aprobacion).toUpperCase().startsWith('APROBAD');
  const aprobadoPersona = txt(persona.aprobacion).toUpperCase().startsWith('APROBAD');
  if (esTitular && aprobadoTitular) {
    throw new ValidationError('El contrato ya está aprobado: el titular no se puede cambiar. Se debe hacer un reemplazo de contrato (contrato nuevo).');
  }

  // Formulario completo de la persona nueva (los vacíos quedan en NULL).
  const nueva: Record<string, any> = {};
  for (const k of permitidos) nueva[k] = txt(datos[k]) === '' ? null : datos[k];
  if (!nueva.primerNombre || !nueva.primerApellido) throw new ValidationError('Nombre y apellido son obligatorios');
  if (!nueva.celular) throw new ValidationError('El celular es obligatorio');
  if (nueva.numeroId && nueva.numeroId === normDoc(persona.numeroId)) {
    throw new ValidationError('El documento es el mismo de la persona actual: use "Corregir datos".');
  }
  const avisos = await verificarDoc(nueva.numeroId || '');
  if (avisos.length && body.confirmarAvisos !== true) {
    return successResponse({ requiereConfirmacion: true, avisos });
  }
  Object.assign(nueva, formatearPersona(nueva, { empresa: esTitular && persona.tipoPersona === 'Empresa' }));
  const pais = titular.plataforma || persona.plataforma;
  nueva.celular = normalizarTelefono(nueva.celular, pais);
  if (nueva.telefono) nueva.telefono = normalizarTelefono(nueva.telefono, pais);
  nueva.nombreCompleto = nombreDe(nueva) || null;

  const antes = Object.fromEntries([...permitidos, 'nombreCompleto'].map(k => [k, k === 'fechaNacimiento' ? fechaISO(persona[k]) || null : persona[k] ?? null]));
  const nombreAnterior = nombreDe(persona) || 'sin nombre';
  const nombreNuevo = nombreDe(nueva);

  // ── Beneficiario APROBADO: nuevo registro + inactivar el anterior (histórico) ──
  if (!esTitular && aprobadoPersona) {
    const nuevoId = ids.person();
    // El vínculo "reemplaza a" queda en el Seguimiento (CONTRATO_EVENTOS) y prellena el comentario de aprobación.
    const cols = [...permitidos, 'nombreCompleto'];
    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO "PEOPLE" ("_id","tipoUsuario","contrato","titularId","plataforma","inicioContrato","fechaContrato",
            "finalContrato","vigencia","tipoContrato","modulo","aprobacion","estado","fechaIngreso","kids","origen",
            ${cols.map(c => `"${c}"`).join(',')}, "_createdDate","_updatedDate")
         SELECT $1,'BENEFICIARIO',o."contrato",COALESCE(o."titularId",$2),o."plataforma",o."inicioContrato",o."fechaContrato",
            o."finalContrato",o."vigencia",o."tipoContrato",COALESCE(o."modulo",false),'Pendiente','SIN APROBAR',NOW(),false,'POSTGRES',
            ${cols.map((_, i) => `$${i + 4}`).join(',')}, NOW(), NOW()
           FROM "PEOPLE" o WHERE o."_id" = $3`,
        [nuevoId, titular._id, persona._id, ...cols.map(c => nueva[c] ?? null)]);
    });
    await registrarEventoContrato({
      personaId: nuevoId, categoria: 'BENEFICIARIOS', accion: 'Beneficiario de reemplazo agregado',
      detalle: `Reemplaza a ${nombreAnterior} · ${motivo}`, datos: { reemplazaA: persona._id, motivo }, session,
    });

    let inactivado = false;
    let errorInactivar: string | null = null;
    if (persona.estadoInactivo !== true) {
      try {
        const u = session?.user as any;
        const r = await toggleStatus(persona._id, false, {
          motivo: `Reemplazado por ${nombreNuevo} (doc. ${nueva.numeroId}). ${motivo}`,
          realizadoPor: u?.email || 'unknown', realizadoPorNombre: u?.name || undefined,
        });
        inactivado = !!r.statusChanged;
      } catch (e: any) {
        errorInactivar = String(e?.message || e);
      }
    }
    await registrarEventoContrato({
      personaId: persona._id, categoria: 'BENEFICIARIOS', accion: 'Beneficiario reemplazado (inactivo, histórico)',
      detalle: `Reemplazado por ${nombreNuevo} · ${motivo}`, datos: { reemplazadoPor: nuevoId, motivo }, session,
    });
    regenerarPdfTrasCambio({ titularId: titular._id, motivo: `Beneficiario reemplazado: ${nombreAnterior} → ${nombreNuevo}`, session });
    return successResponse({
      ok: true, modo, tipo: 'BENEFICIARIO_APROBADO', nuevoId, inactivado, pdfRegenerado: true,
      resumen: `Se agregó a ${nombreNuevo} como beneficiario (sin aprobar) y ${nombreAnterior} quedó inactivo como histórico.`,
      aviso: errorInactivar
        ? `El nuevo beneficiario quedó creado, pero no se pudo inactivar a ${nombreAnterior}: ${errorInactivar}. Inactívelo desde la ficha.`
        : null,
    });
  }

  // ── Sobrescribir el mismo registro (titular o beneficiario SIN aprobar) ──
  const docAnterior = txt(persona.numeroId);
  await withTransaction(async (client) => {
    // Ficha académica de la persona anterior: con clases → bloquea; sin clases → se borra
    // (misma regla que eliminar un beneficiario). Titular: solo la ligada a su propia fila.
    const fichas = (await client.query(
      `SELECT a."_id",
              (SELECT COUNT(*) FROM "ACADEMICA_BOOKINGS" b WHERE b."studentId" = a."_id" OR b."idEstudiante" = a."_id")::int AS clases
         FROM "ACADEMICA" a
        WHERE a."usuarioId" = $1
           OR ($4::boolean = false AND $2 <> '' AND a."numeroId" = $2 AND a."contrato" = $3)`,
      [persona._id, docAnterior, persona.contrato, esTitular])).rows as { _id: string; clases: number }[];
    if (fichas.some(f => f.clases > 0)) {
      throw new ValidationError(`${nombreAnterior} ya tiene clases tomadas: no se reemplaza. Use "Inactivar" y agregue al nuevo beneficiario desde la ficha.`);
    }
    if (fichas.length) {
      await client.query(`DELETE FROM "ACADEMICA" WHERE "_id" = ANY($1::text[])`, [fichas.map(f => f._id)]);
    }

    const cols = [...permitidos, 'nombreCompleto'];
    await client.query(
      `UPDATE "PEOPLE" SET ${cols.map((c, i) => `"${c}" = $${i + 2}`).join(', ')}, "_updatedDate" = NOW() WHERE "_id" = $1`,
      [persona._id, ...cols.map(c => nueva[c] ?? null)]);

    if (esTitular) {
      await client.query(
        `UPDATE "FINANCIEROS" SET "numeroId" = $2, "primerNombre" = $3, "primerApellido" = $4 WHERE "contrato" = $1`,
        [persona.contrato, nueva.numeroId, nueva.primerNombre, nueva.primerApellido]);
      await client.query(`UPDATE "PAGOS_TITULARES" SET "numeroId" = $2 WHERE "idPeople" = $1`, [persona._id, nueva.numeroId]);
    }

    // Titular reemplazado: la firma nombraba a otra persona → se anula y hay que
    // solicitarla de nuevo. Un beneficiario reemplazado conserva la firma (2026-11-27).
    if (esTitular) {
      await client.query(
        `UPDATE "PEOPLE" SET "consentimientoDeclarativo" = NULL, "hashConsentimiento" = NULL,
                "numeroDocumentoVerificado" = NULL, "driveFileId" = NULL,
                "listoAprobacion" = false, "listoAprobacionPor" = NULL, "listoAprobacionEn" = NULL,
                "_updatedDate" = NOW()
          WHERE "_id" = $1`,
        [titular._id]);
    }
  });
  const firmaAnulada = esTitular && firmado;

  await registrarEventoContrato({
    personaId: persona._id, categoria: esTitular ? 'MATRICULA' : 'BENEFICIARIOS',
    accion: esTitular ? 'Titular reemplazado' : 'Beneficiario reemplazado',
    detalle: `${nombreAnterior} → ${nombreNuevo} · ${motivo}`,
    datos: { cambios: Object.fromEntries(Object.keys(antes).map(k => [k, { antes: antes[k], despues: nueva[k] ?? null }])), motivo, etiqueta: 'Reemplazo desde Resumen' },
    session,
  });
  if (firmaAnulada) {
    await registrarEventoContrato({
      personaId: titular._id, categoria: 'FIRMA', accion: 'Firma anulada por reemplazo',
      detalle: `Se reemplazó a ${nombreAnterior}: el contrato debe firmarse de nuevo.`, session,
    });
  }
  await registrarEventoContrato({
    personaId: titular._id, categoria: 'DOCUMENTOS', accion: 'Revisar documentación (reemplazo)',
    detalle: `Se reemplazó a ${nombreAnterior} por ${nombreNuevo}: revise que la documentación corresponda.`, session,
  });

  // PDF nuevo con los datos actuales (reemplaza al anterior en el Drive): al titular
  // sin firma; al beneficiario, con la firma que se conserva.
  regenerarPdfTrasCambio({ titularId: titular._id, motivo: `${esTitular ? 'Titular' : 'Beneficiario'} reemplazado: ${nombreAnterior} → ${nombreNuevo}`, session });
  return successResponse({
    ok: true, modo, tipo: esTitular ? 'TITULAR' : 'BENEFICIARIO', firmaAnulada, pdfRegenerado: true,
    resumen: `${esTitular ? 'Titular' : 'Beneficiario'}: ${nombreAnterior} → ${nombreNuevo}.`,
  });
});
