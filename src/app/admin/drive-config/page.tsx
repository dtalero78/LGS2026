'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';

type Mode = 'bsl' | 'lgs';

export default function DriveConfigPage() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/drive-mode');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
      setMode(data.mode);
      setConfigured(!!data.configured);
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar el estado');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const change = async (next: Mode) => {
    if (next === mode) return;
    setSaving(true);
    setError('');
    setOk('');
    try {
      const res = await fetch('/api/admin/drive-mode', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
      setMode(data.mode);
      setOk(next === 'lgs'
        ? 'Modo LGS activo: los contratos se suben directo a la Unidad compartida.'
        : 'Modo bsl-utilidades activo: los contratos se suben vía la app externa.');
    } catch (e: any) {
      setError(e?.message || 'No se pudo cambiar el modo');
    } finally {
      setSaving(false);
    }
  };

  const Card = ({ value, title, subtitle }: { value: Mode; title: string; subtitle: string }) => {
    const active = mode === value;
    return (
      <button
        type="button"
        onClick={() => change(value)}
        disabled={saving || loading}
        className={`flex-1 text-left rounded-xl border-2 p-5 transition-colors disabled:opacity-60 ${
          active ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white hover:border-gray-300'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-base font-bold text-gray-900">{title}</span>
          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full border-2 ${active ? 'border-emerald-500' : 'border-gray-300'}`}>
            {active && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />}
          </span>
        </div>
        <p className="mt-2 text-sm text-gray-600">{subtitle}</p>
      </button>
    );
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900">Archivado de Contratos en Drive</h1>
        <p className="mt-1 text-gray-600">
          Interruptor de dónde se suben (y descargan) los PDF de contrato. El cambio aplica en ≤1 minuto.
        </p>

        {loading ? (
          <div className="mt-8 text-gray-500">Cargando…</div>
        ) : (
          <>
            <div className="mt-6 flex flex-col sm:flex-row gap-4">
              <Card
                value="bsl"
                title="bsl-utilidades (externo)"
                subtitle="Sube el PDF vía la app externa bsl-utilidades. Comportamiento previo."
              />
              <Card
                value="lgs"
                title="LGS directo (Unidad compartida)"
                subtitle="Sube el PDF directo a la Unidad compartida CONTRATOS LGS con la cuenta de servicio. LGS controla el nombre del archivo."
              />
            </div>

            {!configured && (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                ⚠️ La cuenta de servicio no está configurada (falta <code>GOOGLE_SERVICE_ACCOUNT_JSON</code> en el entorno).
                El modo <b>LGS directo</b> no se puede activar hasta configurarla en Digital Ocean.
              </div>
            )}
            {error && (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
            )}
            {ok && (
              <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{ok}</div>
            )}

            <div className="mt-6 text-xs text-gray-400">
              Modo actual: <b>{mode}</b>{saving ? ' · guardando…' : ''}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
