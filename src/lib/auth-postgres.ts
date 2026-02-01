/**
 * Authentication Module with PostgreSQL
 * Priority: PostgreSQL → Wix → Test Users
 */

import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { queryOne } from './postgres'

interface UserRole {
  _id: string
  email: string
  password: string
  nombre: string
  rol: string
  activo: boolean
}

/**
 * Verify user credentials against PostgreSQL
 */
async function verifyUserPostgres(email: string, password: string) {
  try {
    console.log('🔍 [PostgreSQL] Buscando usuario:', email);

    const user = await queryOne<UserRole>(
      `SELECT "_id", "email", "password", "nombre", "rol", "activo"
       FROM "USUARIOS_ROLES"
       WHERE "email" = $1`,
      [email]
    );

    if (!user) {
      console.log('⚠️ [PostgreSQL] Usuario no encontrado');
      return null;
    }

    if (!user.activo) {
      console.log('⚠️ [PostgreSQL] Usuario inactivo');
      return null;
    }

    console.log('✅ [PostgreSQL] Usuario encontrado:', {
      email: user.email,
      rol: user.rol,
      activo: user.activo
    });

    // Verify password
    let isPasswordValid = false;

    if (user.password) {
      // Check if password is a bcrypt hash
      if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$')) {
        console.log('🔐 [PostgreSQL] Verificando con bcrypt');
        isPasswordValid = await bcrypt.compare(password, user.password);
      } else {
        // Plain text comparison (legacy support)
        console.log('⚠️ [PostgreSQL] Contraseña en texto plano');
        isPasswordValid = password === user.password;
      }
    }

    if (isPasswordValid) {
      console.log('✅ [PostgreSQL] Login exitoso');
      return {
        id: user._id,
        email: user.email,
        name: user.nombre,
        role: user.rol,
      };
    } else {
      console.log('❌ [PostgreSQL] Contraseña incorrecta');
      return null;
    }
  } catch (error) {
    console.error('❌ [PostgreSQL] Error:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Verify user credentials against Wix (fallback)
 */
async function verifyUserWix(email: string, password: string) {
  try {
    const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions';
    console.log('🌐 [Wix] Intentando autenticación');

    const wixResponse = await fetch(
      `${WIX_API_BASE_URL}/userRole?email=${encodeURIComponent(email)}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (!wixResponse.ok) {
      console.log('⚠️ [Wix] API no disponible');
      return null;
    }

    const wixData = await wixResponse.json();

    if (wixData.success && wixData.activo) {
      console.log('✅ [Wix] Usuario encontrado:', {
        email: wixData.email,
        rol: wixData.rol
      });

      if (wixData.password) {
        let isPasswordValid = false;

        if (wixData.password.startsWith('$2a$') || wixData.password.startsWith('$2b$') || wixData.password.startsWith('$2y$')) {
          console.log('🔐 [Wix] Verificando con bcrypt');
          isPasswordValid = await bcrypt.compare(password, wixData.password);
        } else {
          console.log('⚠️ [Wix] Contraseña en texto plano');
          isPasswordValid = password === wixData.password;
        }

        if (isPasswordValid) {
          console.log('✅ [Wix] Login exitoso');
          return {
            id: wixData.email,
            email: wixData.email,
            name: wixData.nombre,
            role: wixData.rol,
          };
        }
      }
    }

    console.log('⚠️ [Wix] Credenciales inválidas');
    return null;
  } catch (error) {
    console.error('❌ [Wix] Error:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Test users fallback
 */
const testUsers = [
  {
    id: '1',
    email: 'superadmin@lgs.com',
    password: 'Test123!',
    name: 'Super Admin',
    role: 'SUPER_ADMIN',
  },
  {
    id: '2',
    email: 'admin@lgs.com',
    password: 'Test123!',
    name: 'Admin',
    role: 'ADMIN',
  },
  {
    id: '3',
    email: 'advisor@lgs.com',
    password: 'Test123!',
    name: 'Advisor',
    role: 'ADVISOR',
  },
  {
    id: '4',
    email: 'comercial@lgs.com',
    password: 'Test123!',
    name: 'Comercial',
    role: 'COMERCIAL',
  },
  {
    id: '5',
    email: 'aprobador@lgs.com',
    password: 'Test123!',
    name: 'Aprobador',
    role: 'APROBADOR',
  },
  {
    id: '6',
    email: 'd_talero@yahoo.com',
    password: 'Test123!',
    name: 'Talero',
    role: 'TALERO',
  },
  {
    id: '7',
    email: 'financiero@lgs.com',
    password: 'Test123!',
    name: 'Financiero',
    role: 'FINANCIERO',
  },
  {
    id: '8',
    email: 'servicio@lgs.com',
    password: 'Test123!',
    name: 'Servicio',
    role: 'SERVICIO',
  },
  {
    id: '9',
    email: 'readonly@lgs.com',
    password: 'Test123!',
    name: 'Solo Lectura',
    role: 'READONLY',
  },
];

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        console.log('🔍 Auth Debug:', {
          inputEmail: credentials.email,
        })

        // Try PostgreSQL only (no fallbacks)
        const pgUser = await verifyUserPostgres(credentials.email, credentials.password);
        if (pgUser) {
          return pgUser;
        }

        console.log('❌ Auth failed - Invalid credentials');
        return null;
      }
    })
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        ;(session.user as any).id = token.sub
        ;(session.user as any).role = token.role
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
}
