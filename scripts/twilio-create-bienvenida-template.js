#!/usr/bin/env node
/**
 * twilio-create-bienvenida-template.js — Crea en la cuenta de Twilio la
 * plantilla de contenido "Bienvenida" (el mensaje que hoy sale por Whapi al
 * aprobar un beneficiario, con el link de auto-registro).
 *
 * Equivalente Twilio del mensaje hardcodeado en:
 *   - src/app/api/postgres/people/[id]/approve/route.ts
 *   - src/app/api/wix/sendWelcomeWhatsApp/route.ts
 *
 * Define DOS tipos en el mismo Content:
 *   - twilio/call-to-action → WhatsApp: el link va en un botón tappable
 *   - twilio/text           → fallback SMS/otros canales: link en línea
 * Twilio elige automáticamente el más rico que soporte el canal.
 *
 * Variables:  {{1}} = primerNombre   ·   {{2}} = ACADEMICA._id (para el link)
 *
 * Credenciales (.env.local): TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN
 *   (o TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET, que tienen prioridad).
 *
 * Idempotente: si ya existe un Content con el mismo friendly_name, NO crea otro.
 * Dry-run por defecto.
 *
 * USO: node scripts/twilio-create-bienvenida-template.js [--apply] [--submit]
 *        --apply   crea la plantilla en la cuenta
 *        --submit  además la envía a aprobación de WhatsApp (revisión de Meta)
 */
require('dotenv').config({ path: '.env.local' });

const APPLY = process.argv.includes('--apply');
const SUBMIT = process.argv.includes('--submit');
const PREVIEW = process.argv.includes('--preview');

// Convención de la cuenta: lgs_<asunto>_<idioma> (cf. lgs_saludo_inicial_es)
const FRIENDLY_NAME = 'lgs_activacion_cuenta_es';
const LANGUAGE = 'es';

// REGLA DE LA CUENTA: todas las plantillas se registran como UTILITY.
// Excepción única: los códigos OTP, que Meta obliga a AUTHENTICATION.
//
// Para que Meta la acepte como UTILITY el texto debe ser TRANSACCIONAL: informa
// de algo que el usuario ya inició (su inscripción fue aprobada) y le da el paso
// siguiente. Nada de felicitaciones, emojis ni tono celebratorio — la versión
// anterior ("¡Eres parte de LGS!" 🎉🚀) fue reclasificada a MARKETING.
const CATEGORY = 'UTILITY';
const BASE_URL = 'https://lgs-plataforma.com/nuevo-usuario/';

// WhatsApp: el link vive en el botón, así que el cuerpo no lo repite.
const BODY_WHATSAPP = [
  'Hola {{1}}:',
  '',
  "Tu inscripción en Let's Go Speak fue aprobada.",
  '',
  'Para activar tu cuenta y completar tu registro, toca el botón de abajo.',
  '',
  'Si tienes alguna pregunta, no dudes en contactarnos.',
].join('\n');

// SMS/otros: mismo texto con el link en línea.
const BODY_TEXT = [
  'Hola {{1}}:',
  '',
  "Tu inscripción en Let's Go Speak fue aprobada.",
  '',
  'Para activar tu cuenta y completar tu registro sigue este enlace:',
  '',
  `${BASE_URL}{{2}}`,
  '',
  'Si tienes alguna pregunta, no dudes en contactarnos.',
].join('\n');

const PAYLOAD = {
  friendly_name: FRIENDLY_NAME,
  language: LANGUAGE,
  // Valores de muestra: Twilio los usa para la vista previa y para la revisión de Meta.
  variables: { 1: 'María', 2: 'acad_7f3k9x2m4' },
  types: {
    'twilio/call-to-action': {
      body: BODY_WHATSAPP,
      actions: [
        {
          type: 'URL',
          title: 'Completar registro', // 18 chars — límite WhatsApp: 25
          url: `${BASE_URL}{{2}}`,
        },
      ],
    },
    'twilio/text': { body: BODY_TEXT },
  },
};

function creds() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  if (!sid) throw new Error('Falta TWILIO_ACCOUNT_SID en .env.local');
  const keySid = process.env.TWILIO_API_KEY_SID;
  const keySecret = process.env.TWILIO_API_KEY_SECRET;
  if (keySid && keySecret) return { sid, user: keySid, pass: keySecret, via: 'API Key' };
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) throw new Error('Falta TWILIO_AUTH_TOKEN (o el par TWILIO_API_KEY_SID/SECRET) en .env.local');
  return { sid, user: sid, pass: token, via: 'Auth Token' };
}

async function tw(url, { user, pass }, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64'),
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* respuesta no-JSON */ }
  return { ok: res.ok, status: res.status, json, text };
}

function preview() {
  const render = (s) => s.replace(/\{\{1\}\}/g, 'María').replace(/\{\{2\}\}/g, 'acad_7f3k9x2m4');
  console.log('\n───────── Vista previa WhatsApp (botón) ─────────');
  console.log(render(BODY_WHATSAPP));
  console.log('  [ Completar registro ] → ' + render(`${BASE_URL}{{2}}`));
  console.log('\n───────── Vista previa fallback texto ───────────');
  console.log(render(BODY_TEXT));
  console.log('─────────────────────────────────────────────────');
}

/** Envía el Content a revisión de WhatsApp/Meta. Devuelve true si quedó encolado. */
async function submitForApproval(contentSid, c) {
  const appr = await tw(
    `https://content.twilio.com/v1/Content/${contentSid}/ApprovalRequests/whatsapp`,
    c,
    {
      method: 'POST',
      body: JSON.stringify({
        name: FRIENDLY_NAME,
        category: CATEGORY,
        // Sin esto Twilio manda allow_category_change=true y Meta puede
        // reclasificar a MARKETING en silencio (más caro + límites de
        // frecuencia). En false, si Meta no la ve como UTILITY la RECHAZA,
        // que es lo que queremos: enterarnos.
        allow_category_change: false,
      }),
    }
  );
  if (!appr.ok) {
    console.error(`\n⚠️  Falló el envío a aprobación (HTTP ${appr.status}): ${appr.json?.message || appr.text}`);
    console.error('   Puedes reintentarlo desde la consola de Twilio.');
    return false;
  }
  console.log(`🟢 Enviada a aprobación de WhatsApp · status: ${appr.json?.status || 'pending'} · categoría: ${CATEGORY}`);
  console.log('   La revisión de Meta suele tardar entre minutos y 24h.');
  return true;
}

(async () => {
  console.log(`\n===== TWILIO · plantilla "${FRIENDLY_NAME}" (${PREVIEW ? 'PREVIEW' : APPLY ? 'APPLY' : 'DRY-RUN'}) =====`);

  // --preview: sólo renderiza el contenido. No toca la red ni pide credenciales.
  if (PREVIEW) {
    preview();
    console.log('\nPayload que se enviaría a POST https://content.twilio.com/v1/Content:');
    console.log(JSON.stringify(PAYLOAD, null, 2));
    return;
  }

  const c = creds();
  console.log(`Cuenta: ${c.sid}  ·  auth vía: ${c.via}`);

  // 1. Verificar credenciales antes de nada
  const acct = await tw(`https://api.twilio.com/2010-04-01/Accounts/${c.sid}.json`, c);
  if (!acct.ok) {
    console.error(`\n❌ Credenciales rechazadas (HTTP ${acct.status}): ${acct.json?.message || acct.text}`);
    console.error('   Verifica TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN en la consola de Twilio.');
    process.exitCode = 1; return;
  }
  console.log(`✓ Cuenta válida: ${acct.json.friendly_name} · status=${acct.json.status}`);

  // 2. Idempotencia: ¿ya existe?
  const list = await tw('https://content.twilio.com/v1/Content?PageSize=100', c);
  if (!list.ok) {
    console.error(`\n❌ No se pudo listar Content (HTTP ${list.status}): ${list.json?.message || list.text}`);
    process.exitCode = 1; return;
  }
  const existing = (list.json.contents || []).find((x) => x.friendly_name === FRIENDLY_NAME);
  if (existing) {
    console.log(`\n⚠️  Ya existe: ${existing.sid} (creado ${existing.date_created}). No se crea otra.`);
    console.log('   Para cambiar el texto: borra esa plantilla en Twilio y vuelve a correr el script.');
    // Re-ejecutable: si ya existe pero falta mandarla a revisión, --submit lo hace.
    if (SUBMIT) {
      console.log('\n→ --submit: enviando la plantilla existente a aprobación de WhatsApp…');
      const ok = await submitForApproval(existing.sid, c);
      if (!ok) process.exitCode = 1;
      return;
    }
    preview();
    return;
  }
  console.log(`✓ No existe todavía — se puede crear (${(list.json.contents || []).length} plantillas en la cuenta)`);

  preview();

  if (!APPLY) {
    console.log('\n[dry-run] usa --apply para crearla en la cuenta.');
    console.log('          añade --submit para enviarla también a aprobación de WhatsApp.');
    console.log('\nPayload que se enviaría:');
    console.log(JSON.stringify(PAYLOAD, null, 2));
    return;
  }

  // 3. Crear
  const created = await tw('https://content.twilio.com/v1/Content', c, {
    method: 'POST',
    body: JSON.stringify(PAYLOAD),
  });
  if (!created.ok) {
    console.error(`\n❌ Error al crear (HTTP ${created.status}): ${created.json?.message || created.text}`);
    process.exitCode = 1; return;
  }
  const contentSid = created.json.sid;
  console.log(`\n🟢 Plantilla creada: ${contentSid}`);

  // 4. Aprobación WhatsApp (opcional)
  if (!SUBMIT) {
    console.log('\nℹ️  NO se envió a aprobación de WhatsApp. Para hacerlo:');
    console.log(`   node scripts/twilio-create-bienvenida-template.js --apply --submit`);
    console.log('   (o desde Content Template Builder en la consola de Twilio)');
    return;
  }

  const ok = await submitForApproval(contentSid, c);
  if (!ok) process.exitCode = 1;
})().catch((e) => { console.error("ERROR:", e.message); process.exitCode = 1; });
