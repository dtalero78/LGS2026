/**
 * /dblgs - Database Viewer & Editor
 *
 * Standalone page (outside DashboardLayout) that provides a Wix-like
 * spreadsheet interface for viewing and editing PostgreSQL tables.
 * Restricted to SUPER_ADMIN/ADMIN roles.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { QueryClient, QueryClientProvider } from 'react-query';
import toast, { Toaster } from 'react-hot-toast';
import {
  useDblgsTables,
  useDblgsSchema,
  useDblgsRows,
  useUpdateCell,
  useInsertRow,
  useDeleteRows,
} from '@/hooks/use-dblgs';
import { Role } from '@/types/permissions';

// ── Types ──────────────────────────────────────────────────────────

interface ColumnMeta {
  name: string;
  type: string;
  pgType: string;
  nullable: boolean;
  defaultValue: string | null;
  maxLength: number | null;
  isPrimaryKey: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────

function getTypeBadge(pgType: string): { label: string; className: string } {
  const map: Record<string, { label: string; className: string }> = {
    varchar: { label: 'T', className: 'bg-blue-100 text-blue-700' },
    text: { label: 'T', className: 'bg-blue-100 text-blue-700' },
    bpchar: { label: 'T', className: 'bg-blue-100 text-blue-700' },
    name: { label: 'T', className: 'bg-blue-100 text-blue-700' },
    uuid: { label: 'T', className: 'bg-blue-100 text-blue-700' },
    int2: { label: '#', className: 'bg-purple-100 text-purple-700' },
    int4: { label: '#', className: 'bg-purple-100 text-purple-700' },
    int8: { label: '#', className: 'bg-purple-100 text-purple-700' },
    float4: { label: '#', className: 'bg-purple-100 text-purple-700' },
    float8: { label: '#', className: 'bg-purple-100 text-purple-700' },
    numeric: { label: '#', className: 'bg-purple-100 text-purple-700' },
    bool: { label: 'B', className: 'bg-green-100 text-green-700' },
    timestamp: { label: 'D', className: 'bg-orange-100 text-orange-700' },
    timestamptz: { label: 'D', className: 'bg-orange-100 text-orange-700' },
    date: { label: 'D', className: 'bg-orange-100 text-orange-700' },
    jsonb: { label: '{}', className: 'bg-yellow-100 text-yellow-700' },
    json: { label: '{}', className: 'bg-yellow-100 text-yellow-700' },
  };
  return map[pgType] || { label: '?', className: 'bg-gray-100 text-gray-600' };
}

function formatCellValue(value: any, pgType: string): string {
  if (value === null || value === undefined) return '';
  if (pgType === 'jsonb' || pgType === 'json') {
    if (typeof value === 'object') {
      const str = JSON.stringify(value);
      return str.length > 80 ? str.substring(0, 80) + '...' : str;
    }
    return String(value).substring(0, 80);
  }
  if (['timestamp', 'timestamptz', 'date'].includes(pgType)) {
    try {
      const d = new Date(value);
      if (pgType === 'date') return d.toISOString().split('T')[0];
      return d.toLocaleString('es-CO', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch { return String(value); }
  }
  if (pgType === 'bool') return value ? 'true' : 'false';
  return String(value);
}

function getEditValue(value: any, pgType: string): string {
  if (value === null || value === undefined) return '';
  if (pgType === 'jsonb' || pgType === 'json') {
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return String(value); }
  }
  if (['timestamp', 'timestamptz'].includes(pgType)) {
    try { return new Date(value).toISOString(); } catch { return String(value); }
  }
  return String(value);
}

// ── QueryClient for standalone page ────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

// ── Main page wrapper (provides QueryClient) ──────────────────────

export default function DblgsPageWrapper() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" />
      <DblgsPage />
    </QueryClientProvider>
  );
}

// ── DblgsPage Component ────────────────────────────────────────────

function DblgsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // ── Auth check ──────────────────────────────────────────────────
  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user) { router.push('/login'); return; }
    const userRole = (session.user as any).role;
    const allowed = [Role.SUPER_ADMIN, Role.ADMIN, 'admin'];
    if (!allowed.includes(userRole)) {
      toast.error('No tienes permisos para acceder');
      router.push('/');
    }
  }, [session, status, router]);

  // ── State ───────────────────────────────────────────────────────
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [debouncedFilters, setDebouncedFilters] = useState<Record<string, string>>({});
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ rowId: string; column: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRowData, setNewRowData] = useState<Record<string, string>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ── Debounce search ─────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // ── Debounce filters ────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedFilters(filters); setPage(1); }, 500);
    return () => clearTimeout(t);
  }, [filters]);

  // ── Data hooks ──────────────────────────────────────────────────
  const { data: tablesData, isLoading: tablesLoading } = useDblgsTables();
  const { data: schemaData } = useDblgsSchema(selectedTable);
  const { data: rowsData, isLoading: rowsLoading, isFetching } = useDblgsRows(selectedTable, {
    page, pageSize, sortBy, sortDir,
    search: debouncedSearch || undefined,
    filters: Object.keys(debouncedFilters).length > 0 ? debouncedFilters : undefined,
  });

  const updateCellMutation = useUpdateCell(selectedTable);
  const insertRowMutation = useInsertRow(selectedTable);
  const deleteRowsMutation = useDeleteRows(selectedTable);

  const tables: string[] = tablesData?.tables || [];
  const columns: ColumnMeta[] = rowsData?.columns || schemaData?.columns || [];
  const rows: any[] = rowsData?.rows || [];
  const total: number = rowsData?.total || 0;
  const totalPages: number = rowsData?.totalPages || 0;

  // ── Table change handler ────────────────────────────────────────
  const handleTableChange = useCallback((tableName: string) => {
    setSelectedTable(tableName || null);
    setPage(1);
    setSortBy(undefined);
    setSortDir('asc');
    setSearch('');
    setDebouncedSearch('');
    setFilters({});
    setDebouncedFilters({});
    setSelectedRows(new Set());
    setEditingCell(null);
    setNewRowData({});
  }, []);

  // ── Sort handler ────────────────────────────────────────────────
  const handleSort = useCallback((colName: string) => {
    if (sortBy === colName) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(colName);
      setSortDir('asc');
    }
    setPage(1);
  }, [sortBy]);

  // ── Cell editing ────────────────────────────────────────────────
  const startEdit = useCallback((rowId: string, column: string, value: any, pgType: string) => {
    setEditingCell({ rowId, column });
    setEditValue(getEditValue(value, pgType));
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
  }, []);

  const saveCell = useCallback(() => {
    if (!editingCell) return;
    const val = editValue === '' ? null : editValue;
    updateCellMutation.mutate(
      { rowId: editingCell.rowId, column: editingCell.column, value: val },
      { onSettled: () => { setEditingCell(null); setEditValue(''); } }
    );
  }, [editingCell, editValue, updateCellMutation]);

  // ── Row selection ───────────────────────────────────────────────
  const toggleRow = useCallback((id: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleAllRows = useCallback(() => {
    if (selectedRows.size === rows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(rows.map(r => r._id)));
    }
  }, [selectedRows.size, rows]);

  // ── Add row ─────────────────────────────────────────────────────
  const handleAddRow = useCallback(() => {
    insertRowMutation.mutate(newRowData, {
      onSuccess: () => { setShowAddModal(false); setNewRowData({}); },
    });
  }, [newRowData, insertRowMutation]);

  // ── Delete rows ─────────────────────────────────────────────────
  const handleDeleteRows = useCallback(() => {
    const ids = Array.from(selectedRows);
    deleteRowsMutation.mutate(ids, {
      onSuccess: () => { setSelectedRows(new Set()); setShowDeleteConfirm(false); },
    });
  }, [selectedRows, deleteRowsMutation]);

  // ── Filter handler ──────────────────────────────────────────────
  const handleFilterChange = useCallback((colName: string, value: string) => {
    setFilters(prev => {
      const next = { ...prev };
      if (value) next[colName] = value; else delete next[colName];
      return next;
    });
  }, []);

  // ── Loading state ───────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Cargando...</div>
      </div>
    );
  }

  const activeFiltersCount = Object.keys(debouncedFilters).length + (debouncedSearch ? 1 : 0) + (sortBy ? 1 : 0);

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-gray-900">Base de Datos LGS</h1>
            <select
              value={selectedTable || ''}
              onChange={e => handleTableChange(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Seleccionar tabla...</option>
              {tables.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            {tablesLoading && <span className="text-xs text-gray-400">Cargando tablas...</span>}
          </div>
          <a
            href="/"
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            Volver al Dashboard
          </a>
        </div>
      </div>

      {!selectedTable ? (
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <div className="text-6xl mb-4">🗄️</div>
            <p className="text-gray-500 text-lg">Selecciona una tabla para comenzar</p>
            <p className="text-gray-400 text-sm mt-1">{tables.length} tablas disponibles</p>
          </div>
        </div>
      ) : (
        <>
          {/* ── Toolbar ──────────────────────────────────────── */}
          <div className="bg-white border-b border-gray-200 px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
                  />
                </div>

                {/* Add Row */}
                <button
                  onClick={() => { setNewRowData({}); setShowAddModal(true); }}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Agregar
                </button>

                {/* Delete */}
                {selectedRows.size > 0 && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Eliminar ({selectedRows.size})
                  </button>
                )}

                {activeFiltersCount > 0 && (
                  <button
                    onClick={() => { setSearch(''); setDebouncedSearch(''); setFilters({}); setDebouncedFilters({}); setSortBy(undefined); setPage(1); }}
                    className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Limpiar filtros ({activeFiltersCount})
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                {/* Page size */}
                <select
                  value={pageSize}
                  onChange={e => { setPageSize(parseInt(e.target.value)); setPage(1); }}
                  className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg bg-white"
                >
                  {[25, 50, 100, 200].map(n => (
                    <option key={n} value={n}>{n} filas</option>
                  ))}
                </select>

                {/* Row count */}
                <span className="text-sm text-gray-500">
                  {total.toLocaleString()} registros
                </span>

                {isFetching && (
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                )}
              </div>
            </div>
          </div>

          {/* ── Table ────────────────────────────────────────── */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              {/* Column headers */}
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr className="border-b border-gray-200">
                  {/* Checkbox header */}
                  <th className="px-2 py-2 w-10 bg-gray-50 sticky left-0 z-20 border-r border-gray-200">
                    <input
                      type="checkbox"
                      checked={rows.length > 0 && selectedRows.size === rows.length}
                      onChange={toggleAllRows}
                      className="rounded border-gray-300"
                    />
                  </th>
                  {/* Row number */}
                  <th className="px-2 py-2 w-12 text-left text-xs font-medium text-gray-400 bg-gray-50 sticky left-10 z-20 border-r border-gray-200">#</th>
                  {columns.map(col => {
                    const badge = getTypeBadge(col.pgType);
                    const isSorted = sortBy === col.name;
                    return (
                      <th
                        key={col.name}
                        className="px-3 py-2 text-left text-xs font-medium text-gray-600 cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap border-r border-gray-100"
                        onClick={() => handleSort(col.name)}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center justify-center w-5 h-4 text-[10px] font-bold rounded ${badge.className}`}>
                            {badge.label}
                          </span>
                          <span className="truncate max-w-[200px]">{col.name}</span>
                          {isSorted && (
                            <span className="text-blue-600">
                              {sortDir === 'asc' ? '▲' : '▼'}
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
                {/* Filter row */}
                <tr className="border-b border-gray-300 bg-gray-50">
                  <td className="px-2 py-1 sticky left-0 z-20 bg-gray-50 border-r border-gray-200" />
                  <td className="px-2 py-1 sticky left-10 z-20 bg-gray-50 border-r border-gray-200" />
                  {columns.map(col => (
                    <td key={col.name} className="px-1 py-1 border-r border-gray-100">
                      <input
                        type="text"
                        placeholder="Filtrar..."
                        value={filters[col.name] || ''}
                        onChange={e => handleFilterChange(col.name, e.target.value)}
                        className="w-full px-1.5 py-0.5 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      />
                    </td>
                  ))}
                </tr>
              </thead>

              {/* Data rows */}
              <tbody className="bg-white">
                {rowsLoading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 2} className="px-4 py-12 text-center text-gray-400">
                      Cargando datos...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 2} className="px-4 py-12 text-center text-gray-400">
                      No se encontraron registros
                    </td>
                  </tr>
                ) : (
                  rows.map((row, rowIdx) => {
                    const rowId = row._id;
                    const isSelected = selectedRows.has(rowId);
                    return (
                      <tr
                        key={rowId || rowIdx}
                        className={`border-b border-gray-100 hover:bg-blue-50/30 ${isSelected ? 'bg-blue-50' : ''}`}
                      >
                        {/* Checkbox */}
                        <td className="px-2 py-1 sticky left-0 z-10 bg-white border-r border-gray-200">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRow(rowId)}
                            className="rounded border-gray-300"
                          />
                        </td>
                        {/* Row number */}
                        <td className="px-2 py-1 text-xs text-gray-400 sticky left-10 z-10 bg-white border-r border-gray-200">
                          {(page - 1) * pageSize + rowIdx + 1}
                        </td>
                        {/* Data cells */}
                        {columns.map(col => {
                          const cellValue = row[col.name];
                          const isEditing = editingCell?.rowId === rowId && editingCell?.column === col.name;
                          const isJsonb = col.pgType === 'jsonb' || col.pgType === 'json';

                          if (isEditing) {
                            if (col.pgType === 'bool') {
                              return (
                                <td key={col.name} className="px-2 py-1 border-r border-gray-100">
                                  <select
                                    autoFocus
                                    value={editValue}
                                    onChange={e => setEditValue(e.target.value)}
                                    onBlur={saveCell}
                                    onKeyDown={e => { if (e.key === 'Escape') cancelEdit(); }}
                                    className="px-1 py-0.5 text-xs border border-blue-500 rounded focus:ring-1 focus:ring-blue-500"
                                  >
                                    <option value="">null</option>
                                    <option value="true">true</option>
                                    <option value="false">false</option>
                                  </select>
                                </td>
                              );
                            }

                            if (isJsonb || (typeof cellValue === 'string' && cellValue.length > 100)) {
                              return (
                                <td key={col.name} className="px-1 py-1 border-r border-gray-100">
                                  <textarea
                                    autoFocus
                                    value={editValue}
                                    onChange={e => setEditValue(e.target.value)}
                                    onBlur={saveCell}
                                    onKeyDown={e => {
                                      if (e.key === 'Escape') cancelEdit();
                                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveCell();
                                    }}
                                    className="w-full min-w-[200px] min-h-[80px] p-1 text-xs border border-blue-500 rounded font-mono focus:ring-1 focus:ring-blue-500 resize"
                                  />
                                </td>
                              );
                            }

                            return (
                              <td key={col.name} className="px-1 py-1 border-r border-gray-100">
                                <input
                                  autoFocus
                                  type="text"
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  onBlur={saveCell}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') saveCell();
                                    if (e.key === 'Escape') cancelEdit();
                                  }}
                                  className="w-full min-w-[100px] px-1 py-0.5 text-xs border border-blue-500 rounded focus:ring-1 focus:ring-blue-500"
                                />
                              </td>
                            );
                          }

                          // Display mode
                          const displayVal = formatCellValue(cellValue, col.pgType);
                          const isBool = col.pgType === 'bool';

                          return (
                            <td
                              key={col.name}
                              className="px-2 py-1 border-r border-gray-100 cursor-pointer hover:bg-blue-50 whitespace-nowrap"
                              onClick={() => startEdit(rowId, col.name, cellValue, col.pgType)}
                              title={cellValue != null ? String(typeof cellValue === 'object' ? JSON.stringify(cellValue) : cellValue) : 'null'}
                            >
                              {cellValue === null || cellValue === undefined ? (
                                <span className="text-gray-300 italic text-xs">null</span>
                              ) : isBool ? (
                                <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${cellValue ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                  {displayVal}
                                </span>
                              ) : (
                                <span className="text-xs truncate block max-w-[300px]">{displayVal}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ──────────────────────────────────── */}
          {totalPages > 0 && (
            <div className="bg-white border-t border-gray-200 px-4 py-2 flex items-center justify-between sticky bottom-0">
              <span className="text-sm text-gray-600">
                {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} de {total.toLocaleString()}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(1)}
                  className="px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ««
                </button>
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <span className="text-sm text-gray-600 px-2">
                  Pág. {page} de {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(totalPages)}
                  className="px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  »»
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Add Row Modal ────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Agregar fila a {selectedTable}
              </h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1 space-y-3">
              {columns
                .filter(c => c.name !== '_createdDate' && c.name !== '_updatedDate')
                .map(col => {
                  const badge = getTypeBadge(col.pgType);
                  const isJsonb = col.pgType === 'jsonb' || col.pgType === 'json';
                  return (
                    <div key={col.name}>
                      <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                        <span className={`inline-flex items-center justify-center w-5 h-4 text-[10px] font-bold rounded ${badge.className}`}>
                          {badge.label}
                        </span>
                        {col.name}
                        {col.isPrimaryKey && <span className="text-yellow-600 text-xs">(PK)</span>}
                        {!col.nullable && <span className="text-red-500 text-xs">*</span>}
                      </label>
                      {col.pgType === 'bool' ? (
                        <select
                          value={newRowData[col.name] || ''}
                          onChange={e => setNewRowData(prev => ({ ...prev, [col.name]: e.target.value }))}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
                        >
                          <option value="">null</option>
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      ) : isJsonb ? (
                        <textarea
                          value={newRowData[col.name] || ''}
                          onChange={e => setNewRowData(prev => ({ ...prev, [col.name]: e.target.value }))}
                          placeholder='{"key": "value"}'
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg font-mono min-h-[60px] resize-y"
                        />
                      ) : (
                        <input
                          type="text"
                          value={newRowData[col.name] || ''}
                          onChange={e => setNewRowData(prev => ({ ...prev, [col.name]: e.target.value }))}
                          placeholder={col.defaultValue ? `Default: ${col.defaultValue}` : col.nullable ? 'null' : 'Requerido'}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
                        />
                      )}
                    </div>
                  );
                })}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddRow}
                disabled={insertRowMutation.isLoading}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {insertRowMutation.isLoading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ─────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Confirmar eliminación</h2>
            <p className="text-sm text-gray-600 mb-4">
              ¿Estás seguro de eliminar <strong>{selectedRows.size}</strong> fila(s) de <strong>{selectedTable}</strong>?
              Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteRows}
                disabled={deleteRowsMutation.isLoading}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteRowsMutation.isLoading ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
