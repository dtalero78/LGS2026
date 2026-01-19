/**
 * Gestión de Permisos Personalizados
 * Permite sobrescribir la configuración por defecto con permisos personalizados
 */

import { Permission, Role } from '@/types/permissions';
import { getPermissionsByRole as getDefaultPermissions } from '@/config/roles';
import fs from 'fs';
import path from 'path';

interface CustomRolesConfig {
  [key: string]: Permission[];
}

let customRolesCache: CustomRolesConfig | null = null;

/**
 * Carga la configuración de permisos personalizados desde archivo JSON o variable de entorno
 */
export function loadCustomRoles(): CustomRolesConfig {
  if (customRolesCache) {
    return customRolesCache;
  }

  // Solo cargar en el servidor (Node.js), no en el cliente (browser)
  if (typeof window !== 'undefined') {
    return {};
  }

  try {
    // PRIORIDAD 1: Intentar cargar desde variable de entorno (para producción)
    if (process.env.CUSTOM_ROLES_CONFIG) {
      console.log('📦 Loading custom roles from environment variable');
      customRolesCache = JSON.parse(process.env.CUSTOM_ROLES_CONFIG);
      return customRolesCache!;
    }

    // PRIORIDAD 2: Intentar cargar desde archivo (para desarrollo)
    const configPath = path.join(process.cwd(), 'src', 'config', 'custom-roles.json');

    if (fs.existsSync(configPath)) {
      console.log('📦 Loading custom roles from file');
      const fileContent = fs.readFileSync(configPath, 'utf-8');
      customRolesCache = JSON.parse(fileContent);
      return customRolesCache!;
    }

    console.log('📦 No custom roles found, using defaults');
  } catch (error) {
    console.error('Error al cargar permisos personalizados:', error);
  }

  return {};
}

/**
 * Invalida el cache de permisos personalizados
 */
export function invalidateCustomRolesCache() {
  customRolesCache = null;
}

/**
 * Obtiene los permisos de un rol, considerando personalizaciones
 * @param role Rol del usuario
 * @returns Array de permisos (personalizados o por defecto)
 */
export function getPermissionsForRole(role: Role): Permission[] {
  const customRoles = loadCustomRoles();

  // Si hay permisos personalizados para este rol, usarlos
  if (customRoles[role]) {
    return customRoles[role];
  }

  // Sino, usar la configuración por defecto
  return getDefaultPermissions(role);
}

/**
 * Verifica si un rol tiene permisos personalizados
 * @param role Rol a verificar
 * @returns true si tiene permisos personalizados
 */
export function hasCustomPermissions(role: Role): boolean {
  const customRoles = loadCustomRoles();
  return !!customRoles[role];
}

/**
 * Guarda permisos personalizados para un rol
 * @param role Rol a modificar
 * @param permissions Array de permisos
 */
export function saveCustomPermissions(role: Role, permissions: Permission[]): void {
  // Solo disponible en el servidor
  if (typeof window !== 'undefined') {
    throw new Error('saveCustomPermissions solo puede ejecutarse en el servidor');
  }

  try {
    const configPath = path.join(process.cwd(), 'src', 'config', 'custom-roles.json');
    let customRoles = loadCustomRoles();

    customRoles[role] = permissions;

    // Guardar en archivo (desarrollo)
    fs.writeFileSync(configPath, JSON.stringify(customRoles, null, 2));
    console.log('💾 Saved to file:', configPath);

    // Mostrar instrucciones para producción
    console.log('');
    console.log('⚠️  IMPORTANTE: Para que los cambios persistan en producción:');
    console.log('');
    console.log('1. Agrega esta variable de entorno en Digital Ocean:');
    console.log('   CUSTOM_ROLES_CONFIG=\'' + JSON.stringify(customRoles) + '\'');
    console.log('');
    console.log('2. O haz commit del archivo custom-roles.json al repositorio');
    console.log('   git add src/config/custom-roles.json');
    console.log('   git commit -m "chore: update custom permissions"');
    console.log('');

    invalidateCustomRolesCache();
  } catch (error) {
    console.error('Error al guardar permisos personalizados:', error);
    throw error;
  }
}

/**
 * Restaura los permisos por defecto para un rol (elimina personalización)
 * @param role Rol a restaurar
 */
export function restoreDefaultPermissions(role: Role): void {
  // Solo disponible en el servidor
  if (typeof window !== 'undefined') {
    throw new Error('restoreDefaultPermissions solo puede ejecutarse en el servidor');
  }

  try {
    const configPath = path.join(process.cwd(), 'src', 'config', 'custom-roles.json');
    let customRoles = loadCustomRoles();

    delete customRoles[role];

    if (Object.keys(customRoles).length === 0) {
      // Si no quedan permisos personalizados, eliminar el archivo
      if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath);
      }
    } else {
      fs.writeFileSync(configPath, JSON.stringify(customRoles, null, 2));
    }

    invalidateCustomRolesCache();
  } catch (error) {
    console.error('Error al restaurar permisos por defecto:', error);
    throw error;
  }
}

/**
 * Obtiene la lista de roles con permisos personalizados
 * @returns Array de roles con personalizaciones
 */
export function getCustomizedRoles(): Role[] {
  const customRoles = loadCustomRoles();
  return Object.keys(customRoles) as Role[];
}
