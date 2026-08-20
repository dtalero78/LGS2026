'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PermissionGuard } from '@/components/permissions';
import { MantenimientoPermission } from '@/types/permissions';

function Content() {
  const [active, setActive] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/kids-config');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
      setActive(!!data.active);
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
      const res = await fetch('/api/admin/kids-config', {
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
      <h1 className="text-2xl font-bold text-gray-900">Proceso Kids</h1>
      <p className="mt-1 text-gray-600">
        Interruptor del proceso Kids en Crear Contrato: el switch “Kids” por beneficiario y su modal
        (datos + curso + apoderado). Con el flag apagado, el switch no se muestra y nada cambia para
        el comercial. El cambio aplica en ≤1 minuto.
      </p>

      {loading ? (
        <div className="mt-8 text-gray-500">Cargando…</div>
      ) : (
        <>
          <div className="mt-6 flex items-center justify-between rounded-xl border-2 p-5 border-gray-200 bg-white">
            <div>
              <div className="text-base font-bold text-gray-900">
                Estado: {active ? <span className="text-emerald-600">Activado</span> : <span className="text-gray-500">Desactivado</span>}
              </div>
              <p className="mt-1 text-sm text-gray-600">
                {active
                  ? 'El switch “Kids” aparece en cada beneficiario del wizard de Crear Contrato.'
                  : 'El switch “Kids” está oculto. Actívalo para habilitar la captura de beneficiarios kids.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={active === true}
              aria-label="Proceso Kids"
              onClick={() => change(!active)}
              disabled={saving}
              className={`relative inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-60 ${active ? 'bg-emerald-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${active ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            ⚠️ El catálogo de Campaña/Curso/Horario todavía es provisional (KIDS2026 aún no está conectado)
            y no se envía nada a KIDS2026. Al activar solo se captura y guarda la inscripción kids dentro de LGS.
          </div>

          {error && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
          )}

          <div className="mt-6 text-xs text-gray-400">
            Estado actual: <b>{active ? 'Activado' : 'Desactivado'}</b>{saving ? ' · guardando…' : ''}
          </div>
        </>
      )}
    </div>
  );
}

export default function KidsConfigPage() {
  return (
    <DashboardLayout>
      <PermissionGuard permission={MantenimientoPermission.KIDS_CONFIG} showDefaultMessage>
        <Content />
      </PermissionGuard>
    </DashboardLayout>
  );
}
