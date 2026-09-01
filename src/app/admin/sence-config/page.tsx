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
      const res = await fetch('/api/admin/sence-config');
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
      const res = await fetch('/api/admin/sence-config', {
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
      <h1 className="text-2xl font-bold text-gray-900">Proceso SENCE</h1>
      <p className="mt-1 text-gray-600">
        Interruptor del proceso SENCE (registro de asistencia por Clave Única en el panel del
        estudiante). Con el flag <b>apagado</b>, los alumnos marcados SENCE <b>NO</b> ven el botón
        “Iniciar sesión SENCE” y entran directo por Zoom, como cualquier estudiante. Actívalo solo
        cuando todos los alumnos SENCE tengan su <code>senceCode</code> configurado. El cambio aplica
        en ≤1 minuto.
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
                  ? 'Los alumnos SENCE ven el botón “Iniciar sesión SENCE” en su ventana de clase (deben registrar antes de entrar a Zoom).'
                  : 'El botón “Iniciar sesión SENCE” está oculto. Los alumnos SENCE entran directo por Zoom.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={active === true}
              aria-label="Proceso SENCE"
              onClick={() => change(!active)}
              disabled={saving}
              className={`relative inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-60 ${active ? 'bg-emerald-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${active ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            ⚠️ Antes de activar: cada alumno marcado SENCE debe tener su <code>senceCode</code>
            (código de curso). Si un alumno SENCE sin código ve el botón, al hacer clic recibe error
            y <b>no puede entrar a su clase</b> (el botón de Zoom solo aparece tras iniciar SENCE).
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

export default function SenceConfigPage() {
  return (
    <DashboardLayout>
      <PermissionGuard permission={MantenimientoPermission.SENCE_CONFIG} showDefaultMessage>
        <Content />
      </PermissionGuard>
    </DashboardLayout>
  );
}
