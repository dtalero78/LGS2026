'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';

function Content() {
  const [active, setActive] = useState<boolean | null>(null);
  const [emails, setEmails] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/filtro-advisors-chile');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
      setActive(!!data.active);
      setEmails(data.emails || []);
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar el estado');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const change = async (next: boolean) => {
    if (next === active || saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/filtro-advisors-chile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
      setActive(!!data.active);
    } catch (e: any) {
      setError(e?.message || 'No se pudo cambiar el estado');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Filtro Advisors Chile (capacitación)</h1>
      <p className="mt-1 text-gray-600">
        Con el filtro activo, los usuarios indicados abajo ven en la <b>Tabla de Asistencia</b> del beneficiario y en los
        <b> informes con advisors</b> (Advisors, Resumen, Programación, Horas Advisor, Usuarios, InfoAcademic) solo las
        clases de advisors de Chile, excepto Joseph Miguel Machado Acosta. Esas pantallas muestran el aviso
        “Mostrando clases con advisors de Chile”. No modifica ningún dato. El cambio aplica en ≤1 minuto.
      </p>

      {loading ? (
        <div className="mt-8 text-gray-500">Cargando…</div>
      ) : (
        <>
          <div className="mt-6 flex items-center justify-between rounded-xl border-2 p-5 border-gray-200 bg-white">
            <div>
              <div className="text-base font-bold text-gray-900">
                Estado: {active ? <span className="text-amber-600">Filtro activo</span> : <span className="text-gray-500">Desactivado</span>}
              </div>
              <p className="mt-1 text-sm text-gray-600">
                Aplica a: {emails.length ? emails.join(', ') : '—'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={active === true}
              aria-label="Filtro advisors Chile"
              onClick={() => change(!active)}
              disabled={saving}
              className={`relative inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-60 ${active ? 'bg-amber-500' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${active ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
          )}

          <div className="mt-6 text-xs text-gray-400">
            Estado actual: <b>{active ? 'Activo' : 'Desactivado'}</b>{saving ? ' · guardando…' : ''}
          </div>
        </>
      )}
    </div>
  );
}

export default function FiltroAdvisorsChilePage() {
  return (
    <DashboardLayout>
      <Content />
    </DashboardLayout>
  );
}
