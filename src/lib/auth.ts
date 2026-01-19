import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'

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
          inputPassword: credentials.password,
        })

        // STEP 1: Verify user exists and is active in Wix
        try {
          // Call Wix API directly instead of going through the proxy
          const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions';
          console.log('🌐 Attempting Wix auth directly:', `${WIX_API_BASE_URL}/userRole`);
          const wixResponse = await fetch(
            `${WIX_API_BASE_URL}/userRole?email=${encodeURIComponent(credentials.email)}`,
            {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
            }
          );

          console.log('📡 Wix API response status:', wixResponse.status);

          if (wixResponse.ok) {
            const wixData = await wixResponse.json();

            if (wixData.success && wixData.activo) {
              // User exists in Wix and is active
              console.log('✅ Usuario verificado en Wix:', {
                email: wixData.email,
                rol: wixData.rol,
                activo: wixData.activo
              });

              // STEP 2: Verify password against Wix password (supports both bcrypt hash and plain text)
              if (wixData.password) {
                let isPasswordValid = false;

                // Check if password is a bcrypt hash (starts with $2a$, $2b$, or $2y$)
                if (wixData.password.startsWith('$2a$') || wixData.password.startsWith('$2b$') || wixData.password.startsWith('$2y$')) {
                  // Use bcrypt comparison for hashed passwords
                  console.log('🔐 Verificando contraseña con bcrypt hash');
                  isPasswordValid = await bcrypt.compare(credentials.password, wixData.password);
                } else {
                  // Direct comparison for plain text passwords (legacy support)
                  console.log('⚠️ Advertencia: Contraseña en texto plano detectada. Considere migrar a bcrypt.');
                  isPasswordValid = credentials.password === wixData.password;
                }

                if (isPasswordValid) {
                  console.log(`✅ Login exitoso con credenciales de Wix: ${wixData.rol}`);
                  return {
                    id: wixData.email, // Use email as ID
                    email: wixData.email,
                    name: wixData.nombre,
                    role: wixData.rol,
                  };
                } else {
                  console.log('❌ Contraseña incorrecta');
                  return null;
                }
              } else {
                console.log('⚠️ Usuario en Wix no tiene contraseña configurada');
                return null;
              }
            } else {
              console.log('⚠️ Usuario no encontrado o inactivo en Wix');
              // Continue to fallback test users
            }
          }
        } catch (error) {
          console.error('❌ Error al verificar usuario en Wix:', error);
          console.error('❌ Error details:', error instanceof Error ? error.message : String(error));
          // Continue to fallback test users
        }

        // FALLBACK: Use hardcoded test users if Wix is not available
        console.log('⚠️ Usando usuarios de prueba locales (Wix no disponible)');

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

        const user = testUsers.find(
          (u) => u.email === credentials.email && u.password === credentials.password
        );

        if (user) {
          console.log(`✅ ${user.role} auth successful (fallback)`);
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          };
        }

        // Check legacy admin from env vars (lowercase 'admin' role)
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@lgs.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';

        if (credentials.email === adminEmail && credentials.password === adminPassword) {
          console.log('✅ Legacy admin auth successful');
          return {
            id: 'legacy-admin',
            email: adminEmail,
            name: 'Admin (Legacy)',
            role: 'admin', // lowercase for backwards compatibility
          };
        }

        console.log('❌ Auth failed');
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

