/**
 * Número de factura de un pago (PAGOS_TITULARES.numeroFactura) — regla única,
 * client-safe (la usan el Centro de Validación y el servidor).
 *
 * La factura se emite FUERA de la plataforma. Se acepta:
 *  - "Admin": facturado por Admin (marca acordada el 2026-10-16), o
 *  - un número real de factura: con al menos 3 dígitos y que no sea un genérico
 *    "LGS…" (se usaban LGS, LGS01, LGS-000, ADMIN, VALIDA, A, B… para vaciar la cola
 *    sin factura real; scripts/normalizar-facturas-admin.js los pasó a "Admin").
 */
export const FACTURA_ADMIN = 'Admin';

export function validarNumeroFactura(v: unknown): { ok: true; valor: string } | { ok: false; error: string } {
  const s = String(v ?? '').trim();
  if (!s) return { ok: false, error: 'El número de factura es obligatorio.' };
  if (/^admin$/i.test(s)) return { ok: true, valor: FACTURA_ADMIN };
  const digitos = s.replace(/\D/g, '').length;
  if (digitos < 3 || /^LGS[-_ ]?\d*$/i.test(s)) {
    return {
      ok: false,
      error: `"${s}" no es un número de factura. Escriba el número real de la factura (con sus dígitos) o use "${FACTURA_ADMIN}" si la facturó Admin.`,
    };
  }
  return { ok: true, valor: s };
}
