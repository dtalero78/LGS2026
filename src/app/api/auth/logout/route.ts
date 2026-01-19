import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  console.log('🚪 Custom logout endpoint called')

  // Obtener todas las cookies
  const cookieStore = cookies()
  const allCookies = cookieStore.getAll()

  console.log('🍪 Current cookies:', allCookies.map(c => c.name))

  // Crear respuesta
  const response = NextResponse.json({ success: true }, { status: 200 })

  // Eliminar TODAS las cookies relacionadas con NextAuth
  const cookiesToDelete = [
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
    'next-auth.callback-url',
    '__Secure-next-auth.callback-url',
    'next-auth.csrf-token',
    '__Secure-next-auth.csrf-token',
  ]

  cookiesToDelete.forEach(cookieName => {
    response.cookies.delete(cookieName)
    console.log(`🗑️ Deleted cookie: ${cookieName}`)
  })

  // También intentar eliminar cualquier cookie que empiece con next-auth
  allCookies.forEach(cookie => {
    if (cookie.name.includes('next-auth')) {
      response.cookies.delete(cookie.name)
      console.log(`🗑️ Deleted cookie: ${cookie.name}`)
    }
  })

  console.log('✅ Logout complete, all NextAuth cookies deleted')

  return response
}
