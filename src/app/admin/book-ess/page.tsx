'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import DashboardLayout from '@/components/layout/DashboardLayout';

/**
 * Mantenimiento › New Books › Book ESS New — interruptor del libro interactivo ESSENTIAL
 * (ST00-00). Encendido: los alumnos ESS · Step 0 activos ven la opción en su
 * panel. Apagado: nadie la ve. Los administradores siempre pueden abrir la
 * vista previa (solo lectura, no guarda avance).
 */
function Content() {
  const [active, setActive] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/book-ess');
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
        setActive(!!data.active);
      } catch (e: any) {
        setError(e?.message || 'No se pudo cargar el estado');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const change = async (next: boolean) => {
    if (next === active || saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/book-ess', {
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
      <h1 className="text-2xl font-bold text-gray-900">Book ESS New</h1>
      <p className="mt-1 text-gray-600">
        Libro interactivo <b>LGS ESSENTIAL</b> (88 páginas, 12 unidades con su evaluación y un reto final),
        integrado al login de LGS. Solo lo ven los alumnos <b>activos</b> en <b>ESS · Step 0</b>. Las
        actividades se califican en el servidor y el avance queda guardado por alumno. El cambio aplica en ≤1 minuto.
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
                  ? 'Los alumnos ESS ven la opción “Book ESS New” en la sección Material de su panel.'
                  : 'La opción está oculta para los alumnos. Puedes revisarla con la vista previa.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={active === true}
              aria-label="Book ESS New"
              onClick={() => change(!active)}
              disabled={saving}
              className={`relative inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-60 ${active ? 'bg-emerald-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${active ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>

          <a
            href="/panel-estudiante/book-ess"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Abrir vista previa
          </a>

          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            El paquete no trae audios: el botón de audio no se muestra hasta que se graben y suban los MP3.
          </div>

          {error && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
          )}
        </>
      )}
    </div>
  );
}

export default function BookEssConfigPage() {
  const { data: session, status } = useSession();
  const role = String((session?.user as any)?.role || '').toUpperCase();
  return (
    <DashboardLayout>
      {status === 'loading' ? null : role === 'SUPER_ADMIN' || role === 'ADMIN' ? (
        <Content />
      ) : (
        <div className="max-w-2xl mx-auto text-gray-600">No tienes permisos para usar esta sección.</div>
      )}
    </DashboardLayout>
  );
}
