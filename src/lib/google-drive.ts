import 'server-only';
import crypto from 'crypto';

/**
 * google-drive.ts — subida/descarga de PDFs a una UNIDAD COMPARTIDA de Google
 * Drive usando una cuenta de servicio, SIN dependencias nuevas (JWT RS256 firmado
 * con `crypto` + REST de Drive vía `fetch`).
 *
 * Config (variables de entorno):
 *   GOOGLE_SERVICE_ACCOUNT_JSON  → el JSON de la cuenta de servicio (crudo o base64).
 *   GOOGLE_DRIVE_FOLDER_ID       → carpeta destino (default = carpeta CONTRATOS LGS).
 *
 * Una cuenta de servicio NO puede subir a "Mi unidad" personal (no tiene cuota
 * propia), pero SÍ a una carpeta de una Unidad compartida (el almacenamiento
 * pertenece a la unidad). La cuenta de servicio tiene acceso a la carpeta como
 * "Gestor de contenido" (puede crear/sobrescribir; NO puede borrar
 * definitivamente — eso lo hace solo el "Administrador" de la unidad).
 *
 * OJO: el parent es el ID REAL de la carpeta CONTRATOS LGS, NO el id de la unidad
 * compartida (0A…). La cuenta de servicio no es MIEMBRO del drive (solo tiene la
 * carpeta compartida por ítem), por eso la búsqueda usa corpora='allDrives' — no
 * corpora='drive'+driveId, que exige membresía.
 *
 * Los archivos se marcan con appProperties {documento, empresa:'LGS'} para poder
 * buscarlos por titularId (mismo criterio con el que se descargan), independiente
 * del nombre visible.
 */

const DEFAULT_FOLDER_ID = '1-DxP4mlk6aJQYY3vRTiPgPouOK9ydWhV'; // carpeta "CONTRATOS LGS"
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || DEFAULT_FOLDER_ID;

interface ServiceAccount { client_email: string; private_key: string }

let _sa: ServiceAccount | null | undefined;
function serviceAccount(): ServiceAccount | null {
  if (_sa !== undefined) return _sa;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) { _sa = null; return null; }
  try {
    // Acepta JSON crudo o base64 (por si se guarda codificado en la variable).
    const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    const parsed = JSON.parse(text);
    const private_key = String(parsed.private_key || '').replace(/\\n/g, '\n');
    if (!parsed.client_email || !private_key) { _sa = null; return null; }
    _sa = { client_email: parsed.client_email, private_key };
  } catch {
    _sa = null;
  }
  return _sa;
}

/** ¿Está configurada la subida directa a Drive? */
export function isDriveDirectConfigured(): boolean {
  return serviceAccount() !== null;
}

/** Diagnóstico: SA en uso + carpeta destino (para depurar la resolución de archivos). */
export function driveDebugInfo(): { saEmail: string | null; folderId: string } {
  return { saEmail: serviceAccount()?.client_email ?? null, folderId: FOLDER_ID };
}

const b64url = (buf: Buffer | string) =>
  (Buffer.isBuffer(buf) ? buf : Buffer.from(buf)).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

let _token: { value: string; exp: number } | null = null;
async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (_token && _token.exp - 60 > now) return _token.value;

  const sa = serviceAccount();
  if (!sa) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON no configurada');

  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const signature = b64url(
    crypto.createSign('RSA-SHA256').update(`${header}.${claim}`).sign(sa.private_key),
  );
  const assertion = `${header}.${claim}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`OAuth token falló: ${data.error_description || data.error || res.status}`);
  }
  _token = { value: data.access_token, exp: now + (data.expires_in || 3600) };
  return _token.value;
}

/**
 * Busca el fileId de un contrato por su documento (titularId) DENTRO de la carpeta
 * CONTRATOS LGS. Null si no existe.
 *
 * OJO: se restringe a `FOLDER_ID in parents` a propósito. La cuenta de servicio
 * también tiene acceso a la carpeta VIEJA de bsl (compartida para la migración),
 * y sin este filtro `corpora='allDrives'` podía resolver el PDF viejo de bsl en
 * vez del de la unidad compartida.
 */
export async function findContractFileId(documento: string): Promise<string | null> {
  const token = await getAccessToken();
  const q = `appProperties has { key='documento' and value='${documento.replace(/'/g, "\\'")}' } and trashed=false and '${FOLDER_ID}' in parents`;
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', q);
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('includeItemsFromAllDrives', 'true');
  url.searchParams.set('corpora', 'allDrives'); // acceso por ítem, sin membresía del drive
  url.searchParams.set('orderBy', 'modifiedTime desc');
  url.searchParams.set('fields', 'files(id,name)');
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(`Drive list falló: ${data?.error?.message || res.status}`);
  return data.files?.[0]?.id ?? null;
}

/** Todos los fileIds de un documento en la carpeta CONTRATOS LGS (para reemplazar). */
async function findAllContractFileIds(documento: string): Promise<string[]> {
  const token = await getAccessToken();
  const q = `appProperties has { key='documento' and value='${documento.replace(/'/g, "\\'")}' } and trashed=false and '${FOLDER_ID}' in parents`;
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', q);
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('includeItemsFromAllDrives', 'true');
  url.searchParams.set('corpora', 'allDrives');
  url.searchParams.set('fields', 'files(id)');
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(`Drive list falló: ${data?.error?.message || res.status}`);
  return (data.files || []).map((f: any) => f.id);
}

/** Envía un archivo a la papelera (la cuenta de servicio no puede borrar definitivamente). */
async function trashFile(fileId: string): Promise<void> {
  const token = await getAccessToken();
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  });
}

/**
 * Sube un PDF de contrato a la unidad compartida. SIEMPRE crea un archivo NUEVO
 * (fileId fresco) y manda los anteriores del mismo documento a la papelera.
 *
 * Por qué crear-nuevo en vez de sobrescribir (PATCH el mismo fileId): al
 * sobrescribir, `files.get?alt=media` de Google puede seguir sirviendo el
 * contenido CACHEADO del fileId por unos minutos → la descarga traía el PDF
 * viejo justo después de regenerar. Un fileId nuevo nunca tuvo caché.
 * (El drive compartido vacía la papelera automáticamente a los 30 días.)
 *
 * Devuelve { fileId, webViewLink }.
 */
export async function uploadContractPdf(
  bytes: Buffer,
  opts: { name: string; documento: string },
): Promise<{ fileId: string; webViewLink: string | null }> {
  const token = await getAccessToken();
  const olds = await findAllContractFileIds(opts.documento);

  const boundary = `lgs${crypto.randomBytes(8).toString('hex')}`;
  const metadata = { name: opts.name, parents: [FOLDER_ID], appProperties: { documento: opts.documento, empresa: 'LGS' } };
  const pre = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,
    'utf8',
  );
  const post = Buffer.from(`\r\n--${boundary}--`, 'utf8');
  const body = Buffer.concat([pre, bytes, post]);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink',
    { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` }, body },
  );
  const data = await res.json();
  if (!res.ok || !data.id) throw new Error(`Drive upload falló: ${data?.error?.message || res.status}`);

  // Papelera para los anteriores (best-effort) → findContractFileId devuelve solo el nuevo.
  for (const oldId of olds) {
    if (oldId !== data.id) { try { await trashFile(oldId); } catch { /* la cuenta de servicio no siempre puede trashear; no rompe */ } }
  }

  return { fileId: data.id, webViewLink: data.webViewLink ?? null };
}

/** Descarga los bytes de un PDF de Drive por fileId. */
export async function downloadDrivePdf(fileId: string): Promise<Buffer> {
  const token = await getAccessToken();
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Drive download falló: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
