import 'server-only'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-postgres'
import { spacesClient, SPACES_BUCKET, getPresignedVideoUrl } from '@/lib/spaces'
import { PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import type { NivelCertificado } from '@/lib/certificado-pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Plantillas de certificados editables. El generador ([certificado-pdf.ts]) lee
// primero `certificados/<nivel>.png` de Spaces y si no existe usa el arte del repo.
const NIVELES: NivelCertificado[] = ['beginner', 'practical', 'functional']
const LABELS: Record<NivelCertificado, string> = {
  beginner: 'Beginner', practical: 'Practical', functional: 'Functional',
}
const spacesKey = (nivel: NivelCertificado) => `certificados/${nivel}.png`

function isAdmin(session: any): boolean {
  const role = String(session?.user?.role ?? '')
  return role === 'SUPER_ADMIN' || role === 'ADMIN'
}

// GET → estado de las 3 plantillas (personalizada en Spaces? + URL de preview)
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const plantillas = await Promise.all(NIVELES.map(async (nivel) => {
    const key = spacesKey(nivel)
    let customizado = false
    try {
      await spacesClient.send(new HeadObjectCommand({ Bucket: SPACES_BUCKET, Key: key }))
      customizado = true
    } catch { customizado = false }
    // Preview: la personalizada (presigned, privada) o el arte del repo (estático).
    const url = customizado
      ? await getPresignedVideoUrl(key, 600)
      : `/certificados/${nivel}.png`
    return { nivel, label: LABELS[nivel], customizado, url }
  }))

  return NextResponse.json({ success: true, plantillas })
}

// POST (FormData: nivel, file) → reemplaza la plantilla en Spaces (solo admin)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autorizado (solo administradores)' }, { status: 403 })

  const form = await req.formData()
  const nivel = form.get('nivel') as string
  const file = form.get('file') as File

  if (!NIVELES.includes(nivel as NivelCertificado)) {
    return NextResponse.json({ error: 'Nivel inválido' }, { status: 400 })
  }
  if (!file?.size) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })

  const esPng = /image\/png/i.test(file.type || '') || file.name.toLowerCase().endsWith('.png')
  if (!esPng) return NextResponse.json({ error: 'La plantilla debe ser una imagen PNG' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  await spacesClient.send(new PutObjectCommand({
    Bucket: SPACES_BUCKET,
    Key: spacesKey(nivel as NivelCertificado),
    Body: buffer,
    ContentType: 'image/png',
    ACL: 'private',
  }))

  return NextResponse.json({ success: true, message: 'Plantilla actualizada correctamente' })
}
