#!/usr/bin/env node
/**
 * twilio-create-firma-templates.js — Crea en Twilio las 3 plantillas del flujo
 * de firma del contrato (consentimiento declarativo), hoy hardcodeadas y
 * enviadas por Whapi.
 *
 * Equivalencias con el código actual:
 *   1. lgs_solicitud_firma_es    ← page.tsx (botón "Solicitar firma")
 *   2. lgs_codigo_verificacion_es ← consent.service.ts (OTP de 6 dígitos)
 *   3. lgs_contrato_pdf_es       ← contracts/[id]/send-pdf (PDF adjunto)
 *
 * OJO con la #2: WhatsApp exige categoría AUTHENTICATION para códigos, y en
 * ese tipo **Meta controla el texto** — sólo se define el código ({{1}}), si
 * se muestra la advertencia de seguridad y los minutos de expiración. El
 * texto propio ("Tu código de verificación de Let's Go Speak es…") NO se
 * puede conservar en WhatsApp; Meta lo reemplaza por su versión localizada.
 *
 * Idempotente: salta las que ya existan (por friendly_name).
 * Dry-run por defecto.
 *
 * USO: node scripts/twilio-create-firma-templates.js [--apply] [--submit] [--preview]
 *        --preview  sólo muestra el contenido, no toca la red ni pide credenciales
 *        --apply    crea las que falten
 *        --submit   además las envía a aprobación de WhatsApp (revisión de Meta)
 */
require('dotenv').config({ path: '.env.local' });

const APPLY = process.argv.includes('--apply');
const SUBMIT = process.argv.includes('--submit');
const PREVIEW = process.argv.includes('--preview');

const URL_CONTRATO = 'https://lgs-plataforma.com/contrato/';

// Muestra para la plantilla de documento. Meta DESCARGA esta URL al aprobar,
// así que tiene que ser un PDF real y público. Además Twilio valida por
// EXTENSIÓN: la URL debe terminar en .pdf — las de API2PDF (que usa el flujo
// productivo) no tienen extensión y son rechazadas. Por eso la muestra vive en
// Spaces. Se puede sobreescribir con --media-sample=<url>.
const MEDIA_SAMPLE_DEFAULT = 'https://lgs-bucket.sfo3.digitaloceanspaces.com/samples/contrato-muestra.pdf';
const MEDIA_SAMPLE =
  (process.argv.find(a => a.startsWith('--media-sample=')) || '').split('=').slice(1).join('=')
  || MEDIA_SAMPLE_DEFAULT;

const TEMPLATES = [
  {
    friendly_name: 'lgs_solicitud_firma_es',
    category: 'UTILITY',
    nota: 'Solicitar firma — link a la página pública del contrato',
    payload: {
      language: 'es',
      variables: { 1: 'María', 2: 'prs_7f3k9x2m4' },
      types: {
        'twilio/call-to-action': {
          body: [
            'Hola {{1}}:',
            '',
            "*¡Tu contrato con Let's Go Speak ya está listo!*",
            '',
            'Para revisarlo y firmarlo, toca el botón de abajo.',
            '',
            'Si tienes alguna pregunta, no dudes en contactarnos.',
          ].join('\n'),
          actions: [
            { type: 'URL', title: 'Revisar y firmar', url: `${URL_CONTRATO}{{2}}` },
          ],
        },
        // Fallback SMS: sin asteriscos (no renderizan) y con el link en línea.
        'twilio/text': {
          body: [
            'Hola {{1}}:',
            '',
            "¡Tu contrato con Let's Go Speak ya está listo!",
            '',
            'Para revisarlo y firmarlo sigue este enlace:',
            '',
            `${URL_CONTRATO}{{2}}`,
            '',
            'Si tienes alguna pregunta, no dudes en contactarnos.',
          ].join('\n'),
        },
      },
    },
  },
  {
    friendly_name: 'lgs_codigo_verificacion_es',
    category: 'AUTHENTICATION',
    nota: 'OTP de firma — texto controlado por Meta, sólo se parametriza el código',
    payload: {
      language: 'es',
      variables: { 1: '123456' },
      types: {
        'whatsapp/authentication': {
          body: '{{1}}',
          add_security_recommendation: true, // "No compartas este código con nadie"
          code_expiration_minutes: 10,       // igual que el TTL de otp-store.ts
          actions: [{ type: 'COPY_CODE', copy_code_text: 'Copiar código' }],
        },
      },
    },
  },
  {
    friendly_name: 'lgs_contrato_pdf_es',
    category: 'UTILITY',
    nota: 'Envío del PDF del contrato — documento adjunto con caption',
    payload: {
      language: 'es',
      variables: { 1: 'María', 2: MEDIA_SAMPLE },
      types: {
        'twilio/media': {
          body: "Hola {{1}}, adjunto encontrarás tu contrato con Let's Go Speak. 📄",
          media: ['{{2}}'],
        },
      },
    },
  },
];

function creds() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  if (!sid) throw new Error('Falta TWILIO_ACCOUNT_SID en .env.local');
  const keySid = process.env.TWILIO_API_KEY_SID;
  const keySecret = process.env.TWILIO_API_KEY_SECRET;
  if (keySid && keySecret) return { sid, user: keySid, pass: keySecret, via: 'API Key' };
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) throw new Error('Falta TWILIO_AUTH_TOKEN (o TWILIO_API_KEY_SID/SECRET) en .env.local');
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
  try { json = JSON.parse(text); } catch { /* no-JSON */ }
  return { ok: res.ok, status: res.status, json, text };
}

function previewOne(t) {
  const vars = t.payload.variables || {};
  const render = (s) => String(s).replace(/\{\{(\d+)\}\}/g, (_, n) => vars[n] ?? `{{${n}}}`);
  console.log(`\n── ${t.friendly_name}  [${t.category}] ──`);
  console.log(`   ${t.nota}`);
  for (const [type, def] of Object.entries(t.payload.types)) {
    console.log(`   · ${type}`);
    if (type === 'whatsapp/authentication') {
      console.log('     (texto generado por Meta en es · advertencia de seguridad · expira en '
        + `${def.code_expiration_minutes} min · botón "${def.actions[0].copy_code_text}")`);
      console.log(`     código de muestra: ${render(def.body)}`);
      continue;
    }
    console.log('     ' + render(def.body).split('\n').join('\n     '));
    if (def.actions) def.actions.forEach(a => console.log(`     [ ${a.title} ] → ${render(a.url)}`));
    if (def.media)   def.media.forEach(m => console.log(`     📎 ${render(m)}`));
  }
}

/** Estado actual de la solicitud de aprobación, o null si nunca se envió. */
async function approvalStatus(contentSid, c) {
  const r = await tw(`https://content.twilio.com/v1/Content/${contentSid}/ApprovalRequests`, c);
  return r.ok ? (r.json?.whatsapp?.status || null) : null;
}

async function submitForApproval(contentSid, t, c) {
  // Un Content sólo admite UNA solicitud: reenviarlo devuelve 400. Consultar
  // antes evita el falso error al re-ejecutar el script.
  // 'unsubmitted' = existe el recurso pero nunca se envió → sí hay que enviarla.
  const EN_TRAMITE = ['received', 'pending', 'approved'];
  const prev = await approvalStatus(contentSid, c);
  if (prev && EN_TRAMITE.includes(prev)) {
    console.log(`   ℹ️  ya estaba en aprobación · status: ${prev} (no se reenvía)`);
    return true;
  }
  if (prev === 'rejected') {
    console.log('   ⚠️  la solicitud previa fue RECHAZADA. Twilio no permite reenviar el mismo');
    console.log('       Content: hay que borrarlo y recrearlo con el contenido corregido.');
    return false;
  }
  const appr = await tw(
    `https://content.twilio.com/v1/Content/${contentSid}/ApprovalRequests/whatsapp`,
    c,
    {
      method: 'POST',
      body: JSON.stringify({
        name: t.friendly_name,
        category: t.category,
        // REGLA DE LA CUENTA: todo se registra como UTILITY (salvo el OTP, que
        // Meta obliga a AUTHENTICATION). Con el flag en false, si Meta no la ve
        // como UTILITY la RECHAZA en vez de reclasificarla a MARKETING sin avisar.
        allow_category_change: false,
      }),
    }
  );
  if (!appr.ok) {
    console.log(`   ⚠️  aprobación falló (HTTP ${appr.status}): ${appr.json?.message || appr.text}`);
    return false;
  }
  console.log(`   🟢 enviada a aprobación · status: ${appr.json?.status || 'pending'} · ${t.category}`);
  return true;
}

(async () => {
  const mode = PREVIEW ? 'PREVIEW' : APPLY ? 'APPLY' : 'DRY-RUN';
  console.log(`\n===== TWILIO · plantillas del flujo de firma (${mode}) =====`);

  if (PREVIEW) { TEMPLATES.forEach(previewOne); return; }

  const c = creds();
  const acct = await tw(`https://api.twilio.com/2010-04-01/Accounts/${c.sid}.json`, c);
  if (!acct.ok) {
    console.error(`\n❌ Credenciales rechazadas (HTTP ${acct.status}): ${acct.json?.message || acct.text}`);
    process.exitCode = 1; return;
  }
  console.log(`Cuenta: ${acct.json.friendly_name} (${c.sid}) · auth vía ${c.via}`);

  const list = await tw('https://content.twilio.com/v1/Content?PageSize=100', c);
  if (!list.ok) {
    console.error(`\n❌ No se pudo listar Content (HTTP ${list.status}): ${list.json?.message || list.text}`);
    process.exitCode = 1; return;
  }
  const byName = new Map((list.json.contents || []).map(x => [x.friendly_name, x]));

  let creadas = 0, existentes = 0, fallidas = 0;

  for (const t of TEMPLATES) {
    console.log(`\n▸ ${t.friendly_name}`);
    const found = byName.get(t.friendly_name);

    if (found) {
      existentes++;
      console.log(`   ya existe: ${found.sid}`);
      if (SUBMIT && !(await submitForApproval(found.sid, t, c))) fallidas++;
      continue;
    }

    if (!APPLY) { console.log('   [dry-run] se crearía'); previewOne(t); continue; }

    const created = await tw('https://content.twilio.com/v1/Content', c, {
      method: 'POST',
      body: JSON.stringify({ friendly_name: t.friendly_name, ...t.payload }),
    });
    if (!created.ok) {
      fallidas++;
      console.log(`   ❌ error al crear (HTTP ${created.status}): ${created.json?.message || created.text}`);
      continue;
    }
    creadas++;
    console.log(`   🟢 creada: ${created.json.sid}`);
    if (SUBMIT && !(await submitForApproval(created.json.sid, t, c))) fallidas++;
  }

  console.log(`\n───── Resumen: ${creadas} creadas · ${existentes} ya existían · ${fallidas} con error ─────`);
  if (!APPLY) console.log('[dry-run] usa --apply para crearlas · añade --submit para enviarlas a aprobación.');
  if (fallidas) process.exitCode = 1;
})().catch((e) => { console.error('ERROR:', e.message); process.exitCode = 1; });
