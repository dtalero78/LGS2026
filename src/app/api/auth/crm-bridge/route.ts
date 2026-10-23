import { NextRequest, NextResponse } from 'next/server'
import { encode } from 'next-auth/jwt'
import { CRM_LADDER_KEYS, CrmLadderKey, verifyCrmBridge } from '@/lib/crm-bridge'

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || ''
const BASE_URL = process.env.NEXTAUTH_URL || 'https://lgs-plataforma.com'
const TOKEN_MAX_AGE_MS = 5 * 60 * 1000 // 5 minutes

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')
  const ts = searchParams.get('ts')
  const token = searchParams.get('token')
  // v2 = the link also carries the sales ladder (fe…ori), all of it signed.
  // v1 links (no `v`) are still accepted so CRM and LGS can deploy in any order.
  const isV2 = searchParams.get('v') === '2'
  const ladder = isV2
    ? (Object.fromEntries(CRM_LADDER_KEYS.map(k => [k, searchParams.get(k) ?? ''])) as Record<CrmLadderKey, string>)
    : undefined
  // Advisor name forwarded by the CRM. NOT part of the HMAC; it only prefills
  // the (editable) PEOPLE.asesorCreadorContrato field.
  const nombre = searchParams.get('nombre') || ''
  const apellido = searchParams.get('apellido') || ''
  const redirect = searchParams.get('redirect') || '/dashboard/comercial/crear-contrato'

  if (!email || !ts || !token) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }

  // Verify timestamp is not expired
  const timestamp = parseInt(ts, 10)
  if (isNaN(timestamp) || Date.now() - timestamp > TOKEN_MAX_AGE_MS) {
    return NextResponse.json({ error: 'Token expired' }, { status: 401 })
  }

  // Verify HMAC signature
  if (!verifyCrmBridge(email, ts, token, ladder)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  // Create a NextAuth-compatible JWT session token
  const sessionToken = await encode({
    token: {
      sub: `crm-bridge-${email}`,
      email,
      name: `CRM Asesor`,
      role: 'COMERCIAL',
    },
    secret: NEXTAUTH_SECRET,
  })

  // Build redirect URL with email param using the public base URL
  const redirectUrl = new URL(redirect, BASE_URL)
  redirectUrl.searchParams.set('email', email)
  if (nombre) redirectUrl.searchParams.set('nombre', nombre)
  if (apellido) redirectUrl.searchParams.set('apellido', apellido)
  // The signed ladder rides on to the form untouched (with ts + token): the
  // contract POST verifies the signature again before writing it to PEOPLE.
  if (ladder) {
    for (const k of CRM_LADDER_KEYS) redirectUrl.searchParams.set(k, ladder[k])
    redirectUrl.searchParams.set('ts', ts)
    redirectUrl.searchParams.set('token', token)
  }

  const response = NextResponse.redirect(redirectUrl)

  // Set the NextAuth session cookie
  // In production (HTTPS), NextAuth uses __Secure- prefix
  const isSecure = BASE_URL.startsWith('https')
  const cookieName = isSecure
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token'

  response.cookies.set(cookieName, sessionToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 60, // 30 minutes session
  })

  return response
}
