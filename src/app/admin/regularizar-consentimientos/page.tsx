'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import DashboardLayout from '@/components/layout/DashboardLayout';

/**
 * Regularización 2026-10-19 — consentimiento + contrato en Drive para los contratos
 * "Sin firmar" que se aprobaron/finalizaron (Grupos 3 y 4). Procesa de a uno
 * (cada uno genera un PDF con API2PDF y lo sube a Drive). Sin WhatsApp.
 */
interface Pendiente { titularId: string; contrato: string; nombre: string }
interface Resultado { contrato: string; nombre: string; ok: boolean; detalle: string }

function Content() {
  const [lista, setLista] = useState<Pendiente[] | null>(null);
  const [error, setError] = useState('');
  const [corriendo, setCorriendo] = useState(false);
  const [resultados, setResultados] = useState<Resultado[]>([]);

  const cargar = async () => {
    setError('');
    try {
      const res = await fetch('/api/admin/regularizar-consentimientos', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
      setLista(data.pendientes);
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar');
    }
  };
  useEffect(() => { cargar(); }, []);

  const procesar = async () => {
    if (!lista?.length || corriendo) return;
    setCorriendo(true);
    setResultados([]);
    for (const p of lista) {
      try {
        const res = await fetch('/api/admin/regularizar-consentimientos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ titularId: p.titularId }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d?.error || `Error ${res.status}`);
        const okDrive = !d.errorPdf;
        setResultados((r) => [...r, {
          contrato: p.contrato, nombre: p.nombre, ok: okDrive,
          detalle: okDrive ? `Consentimiento + contrato en Drive${d.anexo?.ok ? ' + anexo' : ''}` : `Consentimiento OK, PDF/Drive falló: ${d.errorPdf}`,
        }]);
      } catch (e: any) {
        setResultados((r) => [...r, { contrato: p.contrato, nombre: p.nombre, ok: false, detalle: e?.message || 'Error' }]);
      }
    }
    setCorriendo(false);
    cargar();
  };

  const ok = resultados.filter((r) => r.ok).length;
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Regularizar consentimientos</h1>
      <p className="mt-1 text-gray-600">
        Contratos que estaban en <b>Centro de Aprobaciones › Sin firmar</b> y se aprobaron o finalizaron el 19/10/2026.
        Para cada uno se genera el consentimiento automático y el contrato en Drive (con su anexo),
        igual que el botón “Auto-aprobar Consentimiento”. <b>No se envía ningún mensaje.</b>
      </p>
      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {lista === null ? <p className="mt-6 text-gray-500">Cargando…</p> : (
        <>
          <div className="mt-6 flex items-center justify-between rounded-xl border-2 border-gray-200 bg-white p-5">
            <div>
              <div className="text-base font-bold text-gray-900">Pendientes: {lista.length}</div>
              <p className="text-sm text-gray-600">Toma unos segundos por contrato (genera el PDF y lo sube a Drive).</p>
            </div>
            <button
              type="button"
              onClick={procesar}
              disabled={corriendo || !lista.length}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {corriendo ? `Procesando ${resultados.length + 1} de ${lista.length}…` : 'Generar consentimiento y contrato'}
            </button>
          </div>
          {resultados.length > 0 && (
            <div className="mt-4 rounded-xl border border-gray-200 bg-white">
              <div className="border-b px-4 py-2 text-sm font-semibold">Resultado: {ok} OK · {resultados.length - ok} con error</div>
              <table className="w-full text-sm">
                <tbody>
                  {resultados.map((r) => (
                    <tr key={r.contrato} className="border-b last:border-0">
                      <td className="px-4 py-2 font-mono">{r.contrato}</td>
                      <td className="px-4 py-2">{r.nombre}</td>
                      <td className={`px-4 py-2 ${r.ok ? 'text-emerald-700' : 'text-red-700'}`}>{r.ok ? '✓ ' : '✗ '}{r.detalle}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function RegularizarConsentimientosPage() {
  const { data: session, status } = useSession();
  const role = String((session?.user as any)?.role || '').toUpperCase();
  return (
    <DashboardLayout>
      {status === 'loading' ? null : role === 'SUPER_ADMIN' || role === 'ADMIN'
        ? <Content />
        : <div className="max-w-2xl mx-auto text-gray-600">No tienes permisos para usar esta sección.</div>}
    </DashboardLayout>
  );
}
