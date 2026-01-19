'use client'

import { useState, useEffect } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@/lib/zod-resolver'
import { z } from 'zod'
import toast from 'react-hot-toast'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  // Check if we should redirect or stay on login
  useEffect(() => {
    async function checkAuth() {
      // COMENTADO: La lógica de bypass de auth está causando problemas
      // El archivo .env.local dice DISABLE_AUTH=false pero Codespaces tiene DISABLE_AUTH=true
      // Por ahora, SIEMPRE verificamos la sesión y NO bypaseamos auth
      /*
      if (isAuthDisabled()) {
        console.log('🔧 Auth is disabled, redirecting to /')
        router.push('/')
        return
      }
      */

      // Check if there's an active session
      const session = await getSession()
      console.log('🔍 Login page - session check:', {
        hasSession: !!session,
        user: session?.user?.email
      })

      // If there's a valid session, redirect to dashboard
      if (session?.user) {
        console.log('✅ Valid session found, redirecting to dashboard')
        router.push('/')
      } else {
        console.log('❌ No session, staying on login page')
      }
    }

    checkAuth()
  }, [router])

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true)

    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      })

      if (result?.error) {
        toast.error('Credenciales inválidas')
      } else {
        toast.success('Inicio de sesión exitoso')

        // Get the session to check the user's role
        const session = await getSession()

        if (session?.user) {
          const userRole = (session.user as any).role
          const userEmail = session.user.email

          console.log('🔍 Login successful - Role:', userRole, 'Email:', userEmail)

          // Redirect advisors to their panel with email as URL param
          if (userRole === 'ADVISOR') {
            console.log('✅ Redirecting ADVISOR to panel-advisor with email:', userEmail)
            router.push(`/panel-advisor?email=${encodeURIComponent(userEmail || '')}`)
          } else {
            // Other roles go to homepage
            router.push('/')
          }
        } else {
          // Fallback to homepage if no session
          router.push('/')
        }
      }
    } catch (error) {
      toast.error('Error al iniciar sesión')
      console.error('Login error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-primary-100">
            <span className="text-2xl">🎓</span>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            LGS Admin Panel
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Inicia sesión en tu cuenta
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                {...register('email')}
                type="email"
                autoComplete="email"
                className="input-field"
                placeholder="tu@email.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-danger-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Contraseña
              </label>
              <input
                {...register('password')}
                type="password"
                autoComplete="current-password"
                className="input-field"
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-danger-600">{errors.password.message}</p>
              )}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-5 h-5 loading-spinner border-white"></div>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}