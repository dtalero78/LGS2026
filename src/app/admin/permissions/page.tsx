/**
 * Página de Administración de Permisos
 * Interfaz agrupada por módulos para gestionar permisos por rol
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
  [key: string]: {
    [key: string]: boolean;
  };
}

// Colores por módulo (con fallback para módulos no definidos)
const MODULE_COLORS: Record<string, { bg: string; border: string; tag: string; text: string }> = {
  [Module.PERSON]: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    tag: 'bg-purple-100 text-purple-800',
    text: 'text-purple-900',
  },
  [Module.STUDENT]: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    tag: 'bg-blue-100 text-blue-800',
    text: 'text-blue-900',
  },
  [Module.ACADEMICO]: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    tag: 'bg-green-100 text-green-800',
    text: 'text-green-900',
  },
  [Module.SERVICIO]: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    tag: 'bg-orange-100 text-orange-800',
    text: 'text-orange-900',
  },
  [Module.COMERCIAL]: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    tag: 'bg-yellow-100 text-yellow-800',
    text: 'text-yellow-900',
  },
  [Module.APROBACION]: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    tag: 'bg-red-100 text-red-800',
    text: 'text-red-900',
  },
};

// Función helper para obtener colores con fallback
const getModuleColors = (module: string) => {
  return MODULE_COLORS[module] || {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    tag: 'bg-gray-100 text-gray-800',
    text: 'text-gray-900',
  };
};

// Función para traducir nombres de módulos en la UI
const getModuleDisplayName = (module: string): string => {
  const translations: Record<string, string> = {
    'PERSON': 'TITULAR',
    'STUDENT': 'BENEFICIARIO',
  };
  return translations[module] || module;
};

export default function PermissionsAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [data, setData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permissionState, setPermissionState] = useState<PermissionState>({});
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [filterModule, setFilterModule] = useState<Module | 'ALL'>('ALL');
  const [hasChanges, setHasChanges] = useState(false);
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');

  // Verificar autenticación y permisos
  useEffect(() => {
    if (status === 'loading') return;

    if (!session?.user) {
      router.push('/login');
      return;
    }

    const userRole = (session.user as any).role as Role;
    console.log('🔍 Permissions page - checking role:', {
      userRole,
      userRoleType: typeof userRole,
      expectedSuperAdmin: Role.SUPER_ADMIN,
      expectedAdmin: Role.ADMIN,
      isSuperAdmin: userRole === Role.SUPER_ADMIN,
      isAdmin: userRole === Role.ADMIN,
      isLegacyAdmin: userRole === 'admin',
    });

    // Permitir acceso a SUPER_ADMIN, ADMIN, o 'admin' (legacy lowercase)
    const allowedRoles = [Role.SUPER_ADMIN, Role.ADMIN, 'admin'];
    const hasAccess = allowedRoles.includes(userRole as string);

    console.log('🔍 Access check:', {
      allowedRoles,
      userRole,
      hasAccess,
      includesCheck: allowedRoles.includes(userRole as string)
    });

    if (!hasAccess) {
      console.log('❌ Access denied, redirecting to /')
      router.push('/');
      return;
    }

    console.log('✅ Access granted to permissions page')

    loadPermissions();
  }, [session, status, router]);

  // Cargar permisos desde API
  const loadPermissions = async () => {
    try {
      setLoading(true);
      console.log('🔄 Cargando permisos desde API...');

      const response = await fetch('/api/permissions', {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        cache: 'no-store',
      });

      const result = await response.json();

      console.log('📊 Respuesta de API:', {
        success: result.success,
        source: result.source,
        rolesCount: result.data?.matrix?.length,
      });

      if (result.success) {
        // Log específico para TALERO
        const taleroData = result.data?.matrix?.find((m: any) => m.role === 'TALERO');
        console.log('🔍 TALERO permisos en frontend:', {
          role: taleroData?.role,
          permissionsCount: taleroData?.count,
          permissions: taleroData?.permissions,
        });

        setData(result.data);
        initializePermissionState(result.data);
      }
    } catch (error) {
      console.error('Error al cargar permisos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Inicializar estado de permisos
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

  // Toggle de permiso
  const togglePermission = (role: Role, permission: Permission) => {
    setPermissionState((prev) => {
      const newState = {
        ...prev,
        [role]: {
          ...prev[role],
          [permission]: !prev[role]?.[permission],
        },
      };
      setHasChanges(true);
      return newState;
    });
  };

  // Toggle todos los permisos de un módulo
  const toggleModulePermissions = (module: Module, checked: boolean) => {
    if (!selectedRole || !data) return;

    const modulePermissions = data.permissions
      .filter(perm => perm.module === module)
      .map(perm => perm.code);

    setPermissionState((prev) => {
      const newState = { ...prev };
      modulePermissions.forEach(perm => {
        newState[selectedRole][perm] = checked;
      });
      setHasChanges(true);
      return newState;
    });
  };

  // Verificar si todos los permisos de un módulo están seleccionados
  const isModuleFullySelected = (module: Module): boolean => {
    if (!selectedRole || !data) return false;

    const modulePermissions = data.permissions
      .filter(perm => perm.module === module)
      .map(perm => perm.code);

    return modulePermissions.every(perm => permissionState[selectedRole]?.[perm]);
  };

  // Verificar si algunos permisos de un módulo están seleccionados (indeterminate)
  const isModulePartiallySelected = (module: Module): boolean => {
    if (!selectedRole || !data) return false;

    const modulePermissions = data.permissions
      .filter(perm => perm.module === module)
      .map(perm => perm.code);

    const selectedCount = modulePermissions.filter(perm => permissionState[selectedRole]?.[perm]).length;
    return selectedCount > 0 && selectedCount < modulePermissions.length;
  };

  // Crear nuevo rol
  const createNewRole = async () => {
    if (!newRoleName.trim()) {
      alert('El nombre del rol es requerido');
      return;
    }

    try {
      setSaving(true);

      const roleName = newRoleName.trim().toUpperCase().replace(/\s+/g, '_');

      console.log('🆕 Creando nuevo rol:', roleName);

      const response = await fetch('/api/roles/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rol: roleName,
          descripcion: newRoleDescription.trim() || `Rol ${roleName}`,
          permisos: [],
          activo: true,
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert(`Rol ${roleName} creado correctamente`);
        setShowCreateRoleModal(false);
        setNewRoleName('');
        setNewRoleDescription('');
        loadPermissions(); // Recargar permisos
      } else {
        alert(`Error al crear rol: ${result.error}`);
        console.error('Error response:', result);
      }
    } catch (error) {
      console.error('Error al crear rol:', error);
      alert(`Error al crear rol: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setSaving(false);
    }
  };

  // Guardar cambios
  const saveChanges = async () => {
    if (!selectedRole) {
      alert('Selecciona un rol para guardar cambios');
      return;
    }

    try {
      setSaving(true);

      const permissions = Object.entries(permissionState[selectedRole] || {})
        .filter(([_, value]) => value)
        .map(([key, _]) => key as Permission)
        .filter(perm => perm && perm !== 'undefined' && perm !== undefined);

      // Validar que no hay permisos inválidos
      if (permissions.length === 0) {
        alert('No hay permisos seleccionados para guardar');
        setSaving(false);
        return;
      }

      const invalidPerms = permissions.filter(p => !p || p === 'undefined');
      if (invalidPerms.length > 0) {
        console.error('❌ Permisos inválidos detectados:', invalidPerms);
        alert('Error: Se detectaron permisos inválidos. Por favor recarga la página e intenta nuevamente.');
        setSaving(false);
        return;
      }

      console.log('💾 Guardando permisos para', selectedRole, ':', permissions);

      const response = await fetch('/api/permissions/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: selectedRole,
          permissions,
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert(`Permisos de ${selectedRole} guardados correctamente`);
        setHasChanges(false);
        loadPermissions();
      } else {
        const errorMsg = result.details
          ? `Error: ${result.error}\n\nDetalles: ${result.details}\n\n${result.hint || ''}`
          : `Error: ${result.error}`;
        alert(errorMsg);
        console.error('Error response:', result);
      }
    } catch (error) {
      console.error('Error al guardar:', error);
      alert(`Error al guardar cambios: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setSaving(false);
    }
  };

  // Exportar a CSV
  const exportToCSV = () => {
    if (!data) return;

    const headers = ['Permiso', 'Módulo', 'Descripción', ...data.roles].join(',');
    const rows = data.permissions.map((perm) => {
      const permValues = data.roles.map((role) =>
        permissionState[role]?.[perm.code] ? 'x' : ''
      );
      return [
        `"${perm.name}"`,
        perm.module,
        `"${perm.description}"`,
        ...permValues,
      ].join(',');
    });

    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'matriz_permisos.csv';
    a.click();
  };

  // Agrupar permisos por módulo
  const groupedPermissions = data?.permissions.reduce((acc, perm) => {
    if (filterModule !== 'ALL' && perm.module !== filterModule) return acc;

    if (!acc[perm.module]) {
      acc[perm.module] = [];
    }
    acc[perm.module].push(perm);
    return acc;
  }, {} as Record<Module, PermissionDefinition[]>) || {};

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
        <div className="text-center">
          <p className="text-red-600">Error al cargar permisos</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Administración de Permisos
              </h1>
              <p className="text-gray-600 mt-1">
                Gestiona los permisos de cada rol en el sistema
              </p>
            </div>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Volver al Dashboard
            </button>
          </div>

          {/* Controles */}
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rol a editar:
              </label>
              <select
                value={selectedRole || ''}
                onChange={(e) => setSelectedRole(e.target.value as Role)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar rol</option>
                {data.roles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filtrar por módulo:
              </label>
              <select
                value={filterModule}
                onChange={(e) => setFilterModule(e.target.value as Module | 'ALL')}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Todos los módulos</option>
                {Object.values(Module).map((module) => (
                  <option key={module} value={module}>
                    {module}
                  </option>
                ))}
              </select>
            </div>

            <div className="ml-auto flex gap-2">
              <button
                onClick={() => setShowCreateRoleModal(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                + Crear Rol
              </button>
              <button
                onClick={exportToCSV}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Exportar CSV
              </button>
              {hasChanges && selectedRole && (
                <button
                  onClick={saveChanges}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Secciones por Módulo */}
        <div className="space-y-6">
          {Object.entries(groupedPermissions).map(([module, permissions]: [string, PermissionDefinition[]]) => {
            const colors = getModuleColors(module);
            const isFullySelected = isModuleFullySelected(module as Module);
            const isPartiallySelected = isModulePartiallySelected(module as Module);

            return (
              <div
                key={module}
                className={`rounded-lg border-2 ${colors.border} ${colors.bg} overflow-hidden`}
              >
                {/* Header del Módulo */}
                <div className={`px-6 py-4 border-b-2 ${colors.border} bg-white flex items-center justify-between`}>
                  <div className="flex items-center gap-4">
                    <h2 className={`text-xl font-bold ${colors.text}`}>
                      {getModuleDisplayName(module)}
                    </h2>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${colors.tag}`}>
                      {permissions.length} permisos
                    </span>
                  </div>

                  {/* Checkbox: Seleccionar Todos */}
                  {selectedRole && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isFullySelected}
                        ref={(el) => {
                          if (el) {
                            el.indeterminate = isPartiallySelected;
                          }
                        }}
                        onChange={(e) => toggleModulePermissions(module as Module, e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Seleccionar todos
                      </span>
                    </label>
                  )}
                </div>

                {/* Lista de Permisos */}
                <div className="p-6">
                  <div className="grid grid-cols-1 gap-4">
                    {permissions.map((perm: PermissionDefinition) => (
                      <div
                        key={perm.code}
                        className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-center gap-4">
                          {/* Checkbox del Permiso */}
                          <input
                            type="checkbox"
                            checked={selectedRole ? (permissionState[selectedRole]?.[perm.code] || false) : false}
                            onChange={() => selectedRole && togglePermission(selectedRole, perm.code)}
                            disabled={!selectedRole}
                            className={`h-5 w-5 rounded border-gray-300 flex-shrink-0 ${
                              selectedRole
                                ? 'text-blue-600 focus:ring-blue-500 cursor-pointer'
                                : 'opacity-30 cursor-not-allowed'
                            }`}
                            title={selectedRole ? `Asignar a ${selectedRole}` : 'Selecciona un rol primero'}
                          />

                          {/* Información del Permiso */}
                          <div className="flex-1">
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="font-medium text-gray-900">{perm.name}</h3>
                                <p className="text-sm text-gray-600 mt-1">{perm.description}</p>
                              </div>
                              <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${colors.tag}`}>
                                {perm.code}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer con información */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                Instrucciones
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>Selecciona un rol para habilitar la edición de permisos</li>
                  <li>Usa &quot;Seleccionar todos&quot; en cada módulo para asignar todos los permisos de ese módulo</li>
                  <li>Los permisos están agrupados por módulo con códigos de colores</li>
                  <li>Marca/desmarca checkboxes individuales para asignar/remover permisos específicos</li>
                  <li>Guarda los cambios cuando termines de editar</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Modal: Crear Nuevo Rol */}
        {showCreateRoleModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Crear Nuevo Rol</h2>
                <button
                  onClick={() => {
                    setShowCreateRoleModal(false);
                    setNewRoleName('');
                    setNewRoleDescription('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre del Rol <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="Ej: COORDINADOR_ACADEMICO"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Se convertirá a mayúsculas y reemplazará espacios por guiones bajos
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción (Opcional)
                  </label>
                  <textarea
                    value={newRoleDescription}
                    onChange={(e) => setNewRoleDescription(e.target.value)}
                    placeholder="Descripción del rol..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-yellow-700">
                        El rol se creará sin permisos. Después de crearlo, selecciónalo para asignar permisos.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={createNewRole}
                    disabled={saving || !newRoleName.trim()}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Creando...' : 'Crear Rol'}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateRoleModal(false);
                      setNewRoleName('');
                      setNewRoleDescription('');
                    }}
                    disabled={saving}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                  >
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
