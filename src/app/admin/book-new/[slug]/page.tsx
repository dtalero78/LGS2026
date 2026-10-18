'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { libroV2 } from '@/lib/libros-v2-catalogo';

/**
 * Mantenimiento › New Books › Book BEG / PRA / FUNC New — interruptor de cada
 * libro interactivo v2. Encendido: los alumnos activos de esa etapa ven la
 * opción en su panel. Los administradores siempre pueden abrir la vista previa.
 */
function Content({ slug }: { slug: string }) {
  const libro = libroV2(slug)!;
  const [active, setActive] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/libro-v2/${slug}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
        setActive(!!data.active);
      } catch (e: any) {
        setError(e?.message || 'No se pudo cargar el estado');
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const change = async (next: boolean) => {
    if (next === active || saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/libro-v2/${slug}`, {
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

  const niveles = { BEGINNER: 'BN1, BN2 y BN3', PRACTICAL: 'P1, P2 y P3', FUNCTIONAL: 'F1, F2 y F3' }[libro.nivel];

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">{libro.menu}</h1>
      <p className="mt-1 text-gray-600">
        Libro interactivo <b>LGS {libro.nivel}</b> (edición revisada v2: episodios con los personajes, lecturas,
        15 checkpoints —12 de episodio, 2 Jump y un final— y el libro completo), integrado al login de LGS. Solo lo ven
        los alumnos <b>activos</b> en {niveles}. Las respuestas se califican en el servidor y el avance queda guardado
        por alumno. El cambio aplica en ≤1 minuto.
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
                  ? `Los alumnos de ${niveles} ven la opción “${libro.menu}” en la sección Material de su panel.`
                  : 'La opción está oculta para los alumnos. Puedes revisarla con la vista previa.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={active === true}
              aria-label={libro.menu}
              onClick={() => change(!active)}
              disabled={saving}
              className={`relative inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-60 ${active ? 'bg-emerald-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${active ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>

          <a
            href={`/panel-estudiante/book-new/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Abrir vista previa
          </a>

          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            El paquete no trae audios grabados: “♫ Voz” usa la voz sintetizada del navegador, como el prototipo.
          </div>

          {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        </>
      )}
    </div>
  );
}

export default function BookNewConfigPage() {
  const params = useParams<{ slug: string }>();
  const slug = String(params?.slug || '');
  const { data: session, status } = useSession();
  const role = String((session?.user as any)?.role || '').toUpperCase();
  return (
    <DashboardLayout>
      {status === 'loading' ? null : !libroV2(slug) ? (
        <div className="max-w-2xl mx-auto text-gray-600">Libro no encontrado.</div>
      ) : role === 'SUPER_ADMIN' || role === 'ADMIN' ? (
        <Content slug={slug} />
      ) : (
        <div className="max-w-2xl mx-auto text-gray-600">No tienes permisos para usar esta sección.</div>
      )}
    </DashboardLayout>
  );
}
