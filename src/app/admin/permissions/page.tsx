/**
 * Página de Administración de Permisos
 * Vista jerárquica: Módulo → Sección (página) → Componentes (botones, secciones)
 */

'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Role,
  Permission,
  PermissionDefinition,
  Module,
} from '@/types/permissions';

interface MatrixData {
  roles: Role[];
  permissions: PermissionDefinition[];
  matrix: {
    role: Role;
    permissions: Permission[];
    count: number;
  }[];
}

interface PermissionState {
  [role: string]: {
    [permission: string]: boolean;
  };
}

const MODULE_COLORS: Record<string, { bg: string; border: string; tag: string; text: string; accent: string }> = {
  [Module.PERSON]: {
    bg: 'bg-purple-50', border: 'border-purple-200', tag: 'bg-purple-100 text-purple-800',
    text: 'text-purple-900', accent: 'text-purple-600',
  },
  [Module.STUDENT]: {
    bg: 'bg-blue-50', border: 'border-blue-200', tag: 'bg-blue-100 text-blue-800',
    text: 'text-blue-900', accent: 'text-blue-600',
  },
  [Module.ACADEMICO]: {
    bg: 'bg-green-50', border: 'border-green-200', tag: 'bg-green-100 text-green-800',
    text: 'text-green-900', accent: 'text-green-600',
  },
  [Module.SERVICIO]: {
    bg: 'bg-orange-50', border: 'border-orange-200', tag: 'bg-orange-100 text-orange-800',
    text: 'text-orange-900', accent: 'text-orange-600',
  },
  [Module.COMERCIAL]: {
    bg: 'bg-yellow-50', border: 'border-yellow-200', tag: 'bg-yellow-100 text-yellow-800',
    text: 'text-yellow-900', accent: 'text-yellow-600',
  },
  [Module.APROBACION]: {
    bg: 'bg-red-50', border: 'border-red-200', tag: 'bg-red-100 text-red-800',
    text: 'text-red-900', accent: 'text-red-600',
  },
};

const getModuleColors = (module: string) => {
  return MODULE_COLORS[module] || {
    bg: 'bg-gray-50', border: 'border-gray-200', tag: 'bg-gray-100 text-gray-800',
    text: 'text-gray-900', accent: 'text-gray-600',
  };
};

const MODULE_DISPLAY_NAMES: Record<string, { title: string; subtitle: string }> = {
  'PERSON': { title: 'TITULAR', subtitle: 'Página /person/[id]' },
  'STUDENT': { title: 'BENEFICIARIO', subtitle: 'Página /student/[id]' },
  'ACADEMICO': { title: 'ACADEMICO', subtitle: 'Menú Académico' },
  'SERVICIO': { title: 'SERVICIO', subtitle: 'Menú Servicio' },
  'COMERCIAL': { title: 'COMERCIAL', subtitle: 'Menú Comercial' },
  'APROBACION': { title: 'APROBACION', subtitle: 'Menú Aprobación' },
};

// Iconos para tipos de componente
const getComponentIcon = (name: string): string => {
  if (name.startsWith('Página')) return '📄';
  if (name.startsWith('Botón')) return '🔘';
  if (name.startsWith('Sección')) return '📋';
  if (name.startsWith('Toggle')) return '🔀';
  if (name.startsWith('Dropdown')) return '📌';
  if (name.startsWith('Panel')) return '🎛️';
  if (name.startsWith('Vista')) return '👁️';
  if (name.startsWith('Editar') || name.startsWith('Edición')) return '✏️';
  if (name.startsWith('Filtros')) return '🔍';
  if (name.startsWith('Columna')) return '📊';
  if (name.startsWith('Acción')) return '⚡';
  if (name.startsWith('Informe')) return '📑';
  if (name.startsWith('Toggles')) return '🔀';
  return '▪️';
};

export default function PermissionsAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [data, setData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permissionState, setPermissionState] = useState<PermissionState>({});
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>({});
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');

  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user) { router.push('/login'); return; }

    const userRole = (session.user as any).role as Role;
    const allowedRoles = [Role.SUPER_ADMIN, Role.ADMIN, 'admin'];
    if (!allowedRoles.includes(userRole as string)) { router.push('/'); return; }

    loadPermissions();
  }, [session, status, router]);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/permissions', {
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
        cache: 'no-store',
      });
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        initializePermissionState(result.data);
      }
    } catch (error) {
      console.error('Error al cargar permisos:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializePermissionState = (matrixData: MatrixData) => {
    const state: PermissionState = {};
    matrixData.roles.forEach((role) => {
      state[role] = {};
      const rolePerms = matrixData.matrix.find((m) => m.role === role);
      matrixData.permissions.forEach((perm) => {
        state[role][perm.code] = rolePerms?.permissions.includes(perm.code) || false;
      });
    });
    setPermissionState(state);
  };

  const togglePermission = (role: Role, permission: Permission) => {
    setPermissionState((prev) => ({
      ...prev,
      [role]: { ...prev[role], [permission]: !prev[role]?.[permission] },
    }));
    setHasChanges(true);
  };

  const toggleSectionPermissions = (sectionPerms: PermissionDefinition[], checked: boolean) => {
    if (!selectedRole) return;
    setPermissionState((prev) => {
      const newState = { ...prev, [selectedRole]: { ...prev[selectedRole] } };
      sectionPerms.forEach(p => { newState[selectedRole][p.code] = checked; });
      return newState;
    });
    setHasChanges(true);
  };

  const toggleModulePermissions = (modulePerms: PermissionDefinition[], checked: boolean) => {
    if (!selectedRole) return;
    setPermissionState((prev) => {
      const newState = { ...prev, [selectedRole]: { ...prev[selectedRole] } };
      modulePerms.forEach(p => { newState[selectedRole][p.code] = checked; });
      return newState;
    });
    setHasChanges(true);
  };

  const isSectionFullySelected = (perms: PermissionDefinition[]): boolean => {
    if (!selectedRole) return false;
    return perms.every(p => permissionState[selectedRole]?.[p.code]);
  };

  const isSectionPartiallySelected = (perms: PermissionDefinition[]): boolean => {
    if (!selectedRole) return false;
    const count = perms.filter(p => permissionState[selectedRole]?.[p.code]).length;
    return count > 0 && count < perms.length;
  };

  const getSelectedCount = (perms: PermissionDefinition[]): number => {
    if (!selectedRole) return 0;
    return perms.filter(p => permissionState[selectedRole]?.[p.code]).length;
  };

  const toggleModuleCollapse = (module: string) => {
    setCollapsedModules(prev => ({ ...prev, [module]: !prev[module] }));
  };

  const createNewRole = async () => {
    if (!newRoleName.trim()) { alert('El nombre del rol es requerido'); return; }
    try {
      setSaving(true);
      const roleName = newRoleName.trim().toUpperCase().replace(/\s+/g, '_');
      const response = await fetch('/api/roles/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rol: roleName, descripcion: newRoleDescription.trim() || `Rol ${roleName}`, permisos: [], activo: true }),
      });
      const result = await response.json();
      if (result.success) {
        alert(`Rol ${roleName} creado correctamente`);
        setShowCreateRoleModal(false);
        setNewRoleName('');
        setNewRoleDescription('');
        loadPermissions();
      } else {
        alert(`Error al crear rol: ${result.error}`);
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setSaving(false);
    }
  };

  const saveChanges = async () => {
    if (!selectedRole) { alert('Selecciona un rol para guardar cambios'); return; }
    try {
      setSaving(true);
      const permissions = Object.entries(permissionState[selectedRole] || {})
        .filter(([_, value]) => value)
        .map(([key]) => key as Permission)
        .filter(p => p && p !== 'undefined');

      const response = await fetch('/api/permissions/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: selectedRole, permissions }),
      });
      const result = await response.json();
      if (result.success) {
        alert(`Permisos de ${selectedRole} guardados (${permissions.length} permisos)`);
        setHasChanges(false);
        loadPermissions();
      } else {
        alert(`Error: ${result.error}${result.details ? `\n${result.details}` : ''}`);
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setSaving(false);
    }
  };

  // Build hierarchical structure: module → section → permissions
  const buildHierarchy = () => {
    if (!data) return {};
    const hierarchy: Record<string, Record<string, PermissionDefinition[]>> = {};
    data.permissions.forEach(perm => {
      const mod = perm.module;
      const sec = perm.section || 'General';
      if (!hierarchy[mod]) hierarchy[mod] = {};
      if (!hierarchy[mod][sec]) hierarchy[mod][sec] = [];
      hierarchy[mod][sec].push(perm);
    });
    return hierarchy;
  };

  const hierarchy = buildHierarchy();

  // Count total permissions for selected role
  const totalSelected = selectedRole
    ? Object.values(permissionState[selectedRole] || {}).filter(Boolean).length
    : 0;
  const totalPerms = data?.permissions.length || 0;

  if (loading || status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando permisos...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-600">Error al cargar permisos</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Permisos por Rol</h1>
              <p className="text-sm text-gray-500 mt-1">
                Selecciona un rol y marca los componentes a los que tiene acceso
              </p>
            </div>
            <button onClick={() => router.push('/')} className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
              Volver al Dashboard
            </button>
          </div>

          {/* Role selector + actions */}
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Rol</label>
              <select
                value={selectedRole || ''}
                onChange={(e) => { setSelectedRole(e.target.value as Role); setHasChanges(false); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- Seleccionar rol --</option>
                {data.roles.map((role) => {
                  const roleData = data.matrix.find(m => m.role === role);
                  return (
                    <option key={role} value={role}>
                      {role} ({roleData?.count || 0} permisos)
                    </option>
                  );
                })}
              </select>
            </div>

            {selectedRole && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
                <span className="text-sm font-medium text-blue-800">{totalSelected}/{totalPerms}</span>
                <span className="text-xs text-blue-600">permisos activos</span>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setShowCreateRoleModal(true)} className="px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                + Crear Rol
              </button>
              {hasChanges && selectedRole && (
                <button onClick={saveChanges} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Modules */}
        <div className="space-y-4">
          {Object.entries(hierarchy).map(([module, sections]) => {
            const colors = getModuleColors(module);
            const display = MODULE_DISPLAY_NAMES[module] || { title: module, subtitle: '' };
            const allModulePerms = Object.values(sections).flat();
            const moduleSelectedCount = getSelectedCount(allModulePerms);
            const isCollapsed = collapsedModules[module];
            const isFullModule = isSectionFullySelected(allModulePerms);
            const isPartialModule = isSectionPartiallySelected(allModulePerms);

            return (
              <div key={module} className={`rounded-xl border ${colors.border} overflow-hidden shadow-sm`}>
                {/* Module Header */}
                <div
                  className={`${colors.bg} px-5 py-3 flex items-center justify-between cursor-pointer select-none`}
                  onClick={() => toggleModuleCollapse(module)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{isCollapsed ? '▸' : '▾'}</span>
                    <div>
                      <h2 className={`text-lg font-bold ${colors.text}`}>{display.title}</h2>
                      <p className="text-xs text-gray-500">{display.subtitle}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors.tag}`}>
                      {allModulePerms.length} componentes
                    </span>
                  </div>

                  <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                    {selectedRole && (
                      <>
                        <span className="text-xs text-gray-500">
                          {moduleSelectedCount}/{allModulePerms.length}
                        </span>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isFullModule}
                            ref={(el) => { if (el) el.indeterminate = isPartialModule; }}
                            onChange={(e) => toggleModulePermissions(allModulePerms, e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-xs font-medium text-gray-600">Todos</span>
                        </label>
                      </>
                    )}
                  </div>
                </div>

                {/* Sections */}
                {!isCollapsed && (
                  <div className="bg-white divide-y divide-gray-100">
                    {Object.entries(sections).map(([sectionName, perms]) => {
                      const sectionSelected = getSelectedCount(perms);
                      const sectionFull = isSectionFullySelected(perms);
                      const sectionPartial = isSectionPartiallySelected(perms);

                      return (
                        <div key={sectionName} className="px-5 py-3">
                          {/* Section Header */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-semibold ${colors.accent}`}>{sectionName}</span>
                              <span className="text-xs text-gray-400">({perms.length})</span>
                            </div>
                            {selectedRole && (
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={sectionFull}
                                  ref={(el) => { if (el) el.indeterminate = sectionPartial; }}
                                  onChange={(e) => toggleSectionPermissions(perms, e.target.checked)}
                                  className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-xs text-gray-500">
                                  {sectionSelected}/{perms.length}
                                </span>
                              </label>
                            )}
                          </div>

                          {/* Permission Items */}
                          <div className="space-y-1">
                            {perms.map(perm => {
                              const isChecked = selectedRole ? (permissionState[selectedRole]?.[perm.code] || false) : false;

                              return (
                                <label
                                  key={perm.code}
                                  className={`flex items-start gap-3 p-2 rounded-lg transition-colors cursor-pointer ${
                                    selectedRole
                                      ? isChecked
                                        ? 'bg-blue-50 hover:bg-blue-100'
                                        : 'hover:bg-gray-50'
                                      : 'opacity-60 cursor-not-allowed'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => selectedRole && togglePermission(selectedRole, perm.code)}
                                    disabled={!selectedRole}
                                    className={`h-4 w-4 rounded border-gray-300 mt-0.5 flex-shrink-0 ${
                                      selectedRole ? 'text-blue-600 focus:ring-blue-500 cursor-pointer' : 'cursor-not-allowed'
                                    }`}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs">{getComponentIcon(perm.name)}</span>
                                      <span className={`text-sm font-medium ${isChecked ? 'text-blue-900' : 'text-gray-800'}`}>
                                        {perm.name}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-0.5 ml-5">{perm.description}</p>
                                  </div>
                                  <code className="text-[10px] text-gray-400 font-mono whitespace-nowrap hidden md:block mt-0.5">
                                    {perm.code}
                                  </code>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sticky save bar */}
        {hasChanges && selectedRole && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg p-3 z-50">
            <div className="max-w-5xl mx-auto flex items-center justify-between">
              <span className="text-sm text-gray-600">
                Cambios sin guardar para <strong>{selectedRole}</strong> ({totalSelected} permisos activos)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => { if (data) initializePermissionState(data); setHasChanges(false); }}
                  className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Descartar
                </button>
                <button
                  onClick={saveChanges}
                  disabled={saving}
                  className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                >
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Role Modal */}
        {showCreateRoleModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Crear Nuevo Rol</h2>
                <button onClick={() => { setShowCreateRoleModal(false); setNewRoleName(''); setNewRoleDescription(''); }} className="text-gray-400 hover:text-gray-600">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Rol *</label>
                  <input type="text" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="Ej: COORDINADOR_ACADEMICO"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" />
                  <p className="text-xs text-gray-500 mt-1">Se convertira a MAYUSCULAS_CON_GUIONES</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion (Opcional)</label>
                  <textarea value={newRoleDescription} onChange={(e) => setNewRoleDescription(e.target.value)}
                    placeholder="Descripcion del rol..." rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={createNewRole} disabled={saving || !newRoleName.trim()}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
                    {saving ? 'Creando...' : 'Crear Rol'}
                  </button>
                  <button onClick={() => { setShowCreateRoleModal(false); setNewRoleName(''); setNewRoleDescription(''); }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
