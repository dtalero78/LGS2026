/**
 * Authentication Module with PostgreSQL
 * Priority: PostgreSQL → Wix → Test Users
 */

import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { queryOne } from './postgres'
import { isContractExpired } from './contract-expiry'

interface UserRole {
  _id: string
  email: string
  password: string
  nombre: string
  rol: string
  activo: boolean
}

/**
 * Verify user credentials against PostgreSQL.
 * Throws 'BLOCKED' if user is inactive (admin disabled).
 * Throws 'EXPIRED' if user is inactive due to expired contract.
 * Returns null for wrong password or user not found.
 */
/** Cuenta por correo o, para las guías de KIDS, por su usuario de KIDS. */
function buscarCuenta(login: string) {
  return queryOne<UserRole & { origenCuenta: string | null; kidsDebeCambiar: boolean | null }>(
    // Sin distinguir mayúsculas (los correos nuevos se guardan en minúsculas — lib/formato-campos —
    // y los antiguos pueden venir mezclados); si existe tal cual se escribió, gana ese.
    `SELECT "_id", "email", "password", "nombre", "rol", "activo", "origenCuenta", "kidsDebeCambiar"
     FROM "USUARIOS_ROLES"
     WHERE LOWER(TRIM("email")) = LOWER(TRIM($1)) OR LOWER("username") = LOWER(TRIM($1))
     ORDER BY ("email" = $1) DESC, "activo" DESC NULLS LAST
     LIMIT 1`,
    [login]
  );
}

/** Clave contra el hash guardado: argon2id (cuentas de KIDS), bcrypt o texto plano (legacy). */
async function claveValida(password: string, guardada: string | null | undefined): Promise<boolean> {
  if (!guardada) return false;
  if (guardada.startsWith('$argon2')) {
    const { argon2Verify } = await import('hash-wasm');
    try { return await argon2Verify({ password, hash: guardada }); } catch { return false; }
  }
  if (guardada.startsWith('$2a$') || guardada.startsWith('$2b$') || guardada.startsWith('$2y$')) {
    console.log('🔐 [PostgreSQL] Verificando con bcrypt');
    return bcrypt.compare(password, guardada);
  }
  console.log('⚠️ [PostgreSQL] Contraseña en texto plano');
  return password === guardada;
}

/**
 * Guía de KIDS que no entra: se le pide a KIDS solo esa cuenta (3,5 s máx.) por si cambió la
 * clave o es nueva allá, y se reintenta una vez. Solo para cuentas de KIDS o inexistentes.
 */
const ultimaConsultaKids = new Map<string, number>()
async function refrescarDesdeKids(login: string): Promise<boolean> {
  // Una consulta por usuario por minuto: intentos repetidos no martillan a KIDS.
  const k = login.trim().toLowerCase()
  const ahora = Date.now()
  if ((ultimaConsultaKids.get(k) || 0) > ahora - 60_000) return false
  ultimaConsultaKids.set(k, ahora)
  if (ultimaConsultaKids.size > 2000) ultimaConsultaKids.clear()
  try {
    const { kidsIntake } = await import('./kids-intake');
    if (!kidsIntake.isConfigured()) return false;
    const { sincronizarGuiasKids } = await import('./kids-guias-sync');
    const r = await Promise.race([
      sincronizarGuiasKids(login.trim()),
      new Promise<null>(res => setTimeout(() => res(null), 3500)),
    ]);
    return Array.isArray(r) && r.some(x => x.estado === 'creada' || x.estado === 'actualizada');
  } catch (e) {
    console.warn('[auth] no se pudo consultar KIDS:', e instanceof Error ? e.message : e);
    return false;
  }
}

async function verifyUserPostgres(email: string, password: string, reintento = false): Promise<any> {
  try {
    console.log('🔍 [PostgreSQL] Buscando usuario:', email);

    const user = await buscarCuenta(email);

    if (!user) {
      console.log('⚠️ [PostgreSQL] Usuario no encontrado');
      if (!reintento && await refrescarDesdeKids(email)) return verifyUserPostgres(email, password, true);
      return null;
    }

    // Look up the user's finalContrato from PEOPLE (TITULAR or BENEFICIARIO,
    // whichever has it). Used both for the inactivity reason check below and
    // for an in-line expiration guard for students.
    const peopleRecord = await queryOne<{ finalContrato: string | null; rol?: string }>(
      `SELECT "finalContrato" FROM "PEOPLE"
       WHERE LOWER("email") = LOWER($1) AND "finalContrato" IS NOT NULL
       ORDER BY "finalContrato" DESC LIMIT 1`,
      [user.email || email]
    );
    const contractExpired = isContractExpired(peopleRecord?.finalContrato);

    // Guía de KIDS inactiva aquí: puede haberse reactivado allá.
    if (!user.activo && user.origenCuenta === 'KIDS' && !reintento && await refrescarDesdeKids(email)) {
      return verifyUserPostgres(email, password, true);
    }

    if (!user.activo) {
      console.log('⚠️ [PostgreSQL] Usuario inactivo — verificando motivo');
      if (contractExpired) {
        console.log('⚠️ [PostgreSQL] Contrato vencido:', peopleRecord?.finalContrato);
        throw new Error('EXPIRED');
      }
      throw new Error('BLOCKED');
    }

    // Defense in depth: even if USUARIOS_ROLES.activo is still true (e.g. cron
    // hasn't run yet, or PEOPLE/USUARIOS_ROLES got desynced), block ESTUDIANTE
    // login when their contract is past the +1 day grace window.
    if (user.rol === 'ESTUDIANTE' && contractExpired) {
      console.log('⚠️ [PostgreSQL] Estudiante con contrato vencido (activo aún true):', peopleRecord?.finalContrato);
      throw new Error('EXPIRED');
    }

    console.log('✅ [PostgreSQL] Usuario encontrado:', {
      email: user.email,
      rol: user.rol,
      activo: user.activo
    });

    // Verify password
    const isPasswordValid = await claveValida(password, user.password);

    // Cuenta de KIDS: si la clave no sirve puede haber cambiado allá → se refresca y reintenta.
    if (!isPasswordValid && user.origenCuenta === 'KIDS' && !reintento && await refrescarDesdeKids(email)) {
      return verifyUserPostgres(email, password, true);
    }
    // KIDS exige cambiar la clave en el próximo ingreso: se hace allá antes de entrar aquí.
    if (isPasswordValid && user.origenCuenta === 'KIDS' && user.kidsDebeCambiar) {
      throw new Error('KIDS_CAMBIAR_CLAVE');
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
    // Re-throw our custom errors so authorize() can propagate them to the client
    if (error instanceof Error && (error.message === 'BLOCKED' || error.message === 'EXPIRED' || error.message === 'KIDS_CAMBIAR_CLAVE')) {
      throw error;
    }
    console.error('❌ [PostgreSQL] Error:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Test users fallback (only used if PostgreSQL is not available)
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

        // Check env-var admin fallback (for local dev)
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;
        if (adminEmail && adminPassword &&
            credentials.email === adminEmail && credentials.password === adminPassword) {
          console.log('✅ [EnvFallback] Admin login via env vars');
          return { id: 'env-admin', email: adminEmail, name: 'Super Admin', role: 'SUPER_ADMIN' };
        }

        // Try PostgreSQL
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
