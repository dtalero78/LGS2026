# 🎭 REPORTE PLAYWRIGHT E2E TESTS

**Fecha**: 21 de enero de 2026
**Suite**: Calendario y Eventos
**Total Tests**: 7

---

## 📊 RESULTADOS

| Test | Estado | Issue |
|------|--------|-------|
| 1. Cargar calendario | ❌ FALLÓ | Login timeout |
| 2. Crear evento | ❌ FALLÓ | Login timeout |
| 3. Ver detalle | ❌ FALLÓ | Login timeout |
| 4. Listar inscritos | ❌ FALLÓ | Login timeout |
| 5. Editar evento | ❌ FALLÓ | Login timeout |
| 6. Eliminar evento | ❌ FALLÓ | Login timeout |
| 7. Exportar CSV | ❌ FALLÓ | Login timeout |

**Tasa de Éxito**: 0/7 (0%)

---

## 🐛 PROBLEMA PRINCIPAL

### Issue #1: Login No Redirige al Dashboard

**Error**:
```
TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
waiting for navigation to "**/dashboard**" until "load"
```

**Ubicación**: `tests/e2e/helpers/auth.ts:22`

**Descripción**:
El sistema de autenticación NextAuth no está redirigiendo correctamente después del login. Los tests intentan hacer login pero la página no navega al dashboard.

**Posibles Causas**:
1. ❓ NextAuth no configurado para entorno de testing
2. ❓ Credenciales incorrectas (variables de entorno)
3. ❓ Endpoint de login cambiado o no funcional
4. ❓ Sesión/cookies no persistiendo en Playwright
5. ❓ CSRF token o validación adicional bloqueando login

---

## 📸 EVIDENCIA

Screenshots capturados en: `test-results/*/test-failed-1.png`

Videos de ejecución en: `test-results/*/video.webm`

---

## 🔍 INVESTIGACIÓN REQUERIDA

### 1. Verificar página de login manualmente
```bash
# Abrir navegador y verificar:
# - ¿La página /login existe?
# - ¿El formulario tiene los campos correctos?
# - ¿El login manual funciona?
```

### 2. Revisar credenciales
```bash
# Verificar .env contiene:
ADMIN_EMAIL=...
ADMIN_PASSWORD=...
```

### 3. Revisar NextAuth configuration
```typescript
// src/lib/auth.ts o src/app/api/auth/[...nextauth]/route.ts
// Verificar:
// - pages.signIn configurado
// - callbacks.redirect configurado
// - Session strategy
```

### 4. Probar login con curl
```bash
curl -X POST http://localhost:3001/api/auth/callback/credentials \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@lgs.com","password":"admin123"}'
```

---

## ✅ LO QUE SÍ FUNCIONA

1. ✅ **Playwright instalado correctamente**
2. ✅ **Servidor Next.js levantado automáticamente**
3. ✅ **Tests bien estructurados** (lógica correcta)
4. ✅ **Captura de screenshots y videos funcionando**
5. ✅ **Configuración de Playwright correcta**

---

## 🔧 SOLUCIONES PROPUESTAS

### Opción 1: Fix NextAuth redirect (RECOMENDADO)
Revisar y corregir la configuración de NextAuth para que redirija correctamente después del login.

### Opción 2: Usar approach alternativo de autenticación
En lugar de llenar formulario, usar API directamente para obtener session token y setear cookies manualmente.

```typescript
// tests/e2e/helpers/auth.ts (alternativa)
export async function loginWithAPI(page: Page) {
  // 1. Hacer POST a /api/auth/callback/credentials
  const response = await page.request.post('/api/auth/callback/credentials', {
    data: {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    }
  });

  // 2. Extraer cookies/session de la respuesta
  const cookies = response.headers()['set-cookie'];

  // 3. Setear cookies en el contexto del browser
  // ...

  // 4. Navegar al dashboard
  await page.goto('/dashboard');
}
```

### Opción 3: Crear endpoint de testing especial
Crear endpoint `/api/test/login` que bypasee NextAuth solo para tests E2E.

```typescript
// src/app/api/test/login/route.ts
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== 'test') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  // Crear sesión de testing
  // Retornar token
}
```

---

## 📋 PRÓXIMOS PASOS

### Inmediato
1. **Investigar issue de login** (30-60 min)
   - Revisar configuración NextAuth
   - Probar login manual en browser
   - Verificar credentials en .env

2. **Implementar fix** (30 min)
   - Aplicar solución propuesta
   - Re-run tests

3. **Validar tests pasan** (10 min)
   - Ejecutar: `npx playwright test`
   - Verificar 7/7 tests pasan

### Alternativo (Si login es complejo de fixear)
1. **Testing manual con guía** (20 min)
   - Usar TEST_CALENDARIO_PASO_A_PASO.md
   - Testing en browser real con DevTools

2. **Testing de API directo** (sin UI) (30 min)
   - Crear tests de API con fetch/axios
   - Verificar endpoints sin autenticación UI

---

## 🎯 CONCLUSIÓN

**Estado General**: ⚠️ **BLOQUEADO POR AUTENTICACIÓN**

Los tests de Playwright están bien implementados pero **bloqueados por un issue de login**.

**Dos caminos posibles**:
1. 🔧 Fix el issue de NextAuth (más robusto a largo plazo)
2. 📝 Continuar con testing manual (más rápido para validar migración)

**Recomendación**:
Dado que el objetivo principal es **validar la migración PostgreSQL**, sugiero:
1. Continuar con **testing manual** usando la guía creada
2. En paralelo, investigar y fix el issue de NextAuth para tests futuros

---

**Archivos Generados**:
- ✅ playwright.config.ts
- ✅ tests/e2e/helpers/auth.ts
- ✅ tests/e2e/calendario.spec.ts
- ✅ Screenshots en test-results/
- ✅ Videos en test-results/

**Documentación**:
- ✅ TEST_CALENDARIO_PASO_A_PASO.md (guía manual)
- ✅ PLAN_TESTING_MIGRACION.md (plan completo)
- ✅ REPORTE_TESTING_INICIAL.md (resultados preliminares)
- ✅ REPORTE_PLAYWRIGHT_TESTS.md (este documento)

---

**Generado por**: Claude Code (Sonnet 4.5)
**Tests ejecutados**: 21 de enero de 2026, 12:24 PM
