/**
 * DBLGS Hooks - React Query v3 data fetching for database viewer
 *
 * Provides hooks for listing tables, reading schema, CRUD operations.
 * Uses the api utility from use-api.ts and react-hot-toast for notifications.
 */

'use client';

import { useQuery, useMutation, useQueryClient } from 'react-query';
import { api, handleApiError } from './use-api';
import toast from 'react-hot-toast';

// ── Query keys ─────────────────────────────────────────────────────

const keys = {
  tables: ['dblgs', 'tables'] as const,
  schema: (table: string) => ['dblgs', 'schema', table] as const,
  rows: (table: string, params: string) => ['dblgs', 'rows', table, params] as const,
};

// ── Queries ────────────────────────────────────────────────────────

export function useDblgsTables() {
  return useQuery(keys.tables, () =>
    api.get<{ success: boolean; tables: string[] }>('/api/postgres/dblgs?action=list-tables')
  );
}

export function useDblgsSchema(table: string | null) {
  return useQuery(
    keys.schema(table!),
    () => api.get(`/api/postgres/dblgs?action=schema&table=${encodeURIComponent(table!)}`),
    { enabled: !!table }
  );
}

export function useDblgsRows(table: string | null, params: Record<string, any>) {
  const searchParams = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '' && v !== null)
      .map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)])
  ).toString();

  return useQuery(
    keys.rows(table!, searchParams),
    () => api.get(`/api/postgres/dblgs/${encodeURIComponent(table!)}?${searchParams}`),
    {
      enabled: !!table,
      keepPreviousData: true,
    }
  );
}

// ── Mutations ──────────────────────────────────────────────────────

export function useUpdateCell(table: string | null) {
  const qc = useQueryClient();
  return useMutation(
    (payload: { rowId: string; column: string; value: any }) =>
      api.patch(`/api/postgres/dblgs/${encodeURIComponent(table!)}`, payload),
    {
      onSuccess: () => {
        qc.invalidateQueries(['dblgs', 'rows', table]);
        toast.success('Celda actualizada');
      },
      onError: (err) => handleApiError(err, 'Error actualizando celda'),
    }
  );
}

export function useInsertRow(table: string | null) {
  const qc = useQueryClient();
  return useMutation(
    (row: Record<string, any>) =>
      api.post(`/api/postgres/dblgs/${encodeURIComponent(table!)}`, { row }),
    {
      onSuccess: () => {
        qc.invalidateQueries(['dblgs', 'rows', table]);
        qc.invalidateQueries(keys.schema(table!)); // rowCount changed
        toast.success('Fila creada exitosamente');
      },
      onError: (err) => handleApiError(err, 'Error creando fila'),
    }
  );
}

export function useDeleteRows(table: string | null) {
  const qc = useQueryClient();
  return useMutation(
    (ids: string[]) =>
      api.delete(`/api/postgres/dblgs/${encodeURIComponent(table!)}`, { ids }),
    {
      onSuccess: (data: any) => {
        qc.invalidateQueries(['dblgs', 'rows', table]);
        qc.invalidateQueries(keys.schema(table!)); // rowCount changed
        toast.success(`${data.deletedCount} fila(s) eliminada(s)`);
      },
      onError: (err) => handleApiError(err, 'Error eliminando filas'),
    }
  );
}
