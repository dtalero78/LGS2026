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
      const res = await fetch('/api/admin/bloqueo-certificado-mora');
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
    if (next && !window.confirm('¿Activar el bloqueo? Los alumnos de contratos en mora no podrán generar su certificado (salvo los desbloqueados por Recaudos).')) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/bloqueo-certificado-mora', {
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
      <h1 className="text-2xl font-bold text-gray-900">Bloqueo de Certificados por Mora</h1>
      <p className="mt-1 text-gray-600">
        Con el bloqueo activo, un alumno cuyo contrato está en mora (cuotas vencidas sin registrar) no puede generar su
        certificado de nivel: al pulsar el nivel ve un aviso con la causa. Recaudos puede desbloquear contratos puntuales
        desde <b>Recaudos › Usuarios en mora</b>. El cambio aplica en ≤1 minuto.
      </p>

      {loading ? (
        <div className="mt-8 text-gray-500">Cargando…</div>
      ) : (
        <>
          <div className="mt-6 flex items-center justify-between rounded-xl border-2 p-5 border-gray-200 bg-white">
            <div>
              <div className="text-base font-bold text-gray-900">
                Estado: {active ? <span className="text-red-600">Bloqueo activo</span> : <span className="text-gray-500">Desactivado</span>}
              </div>
              <p className="mt-1 text-sm text-gray-600">
                {active
                  ? 'Los contratos en mora no pueden generar certificados (excepto los desbloqueados).'
                  : 'Los certificados se generan sin revisar pagos. El informe Usuarios en mora sigue disponible.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={active === true}
              aria-label="Bloqueo de certificados por mora"
              onClick={() => change(!active)}
              disabled={saving}
              className={`relative inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-60 ${active ? 'bg-red-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${active ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            ⚠️ Los pagos de cuotas se registran en la plataforma desde mayo de 2026. Muchos contratos anteriores aparecen en mora
            sin estarlo porque sus cuotas no se cargaron. Antes de activar, revise con Recaudos el informe <b>Usuarios en mora</b>.
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

export default function BloqueoCertificadoMoraPage() {
  return (
    <DashboardLayout>
      <PermissionGuard permission={MantenimientoPermission.BLOQUEO_CERT_MORA} showDefaultMessage>
        <Content />
      </PermissionGuard>
    </DashboardLayout>
  );
}
