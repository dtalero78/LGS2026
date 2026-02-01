#!/usr/bin/env node

/**
 * Script para actualizar todas las llamadas de /api/wix-proxy a /api/postgres
 *
 * Uso: node update-frontend-endpoints.js
 */

const fs = require('fs');
const path = require('path');

// Mapeo de endpoints wix-proxy → postgres
const ENDPOINT_MAPPINGS = [
  // Event Management
  { from: '/api/wix-proxy/calendario-event?id=', to: '/api/postgres/events/' },
  { from: "'/api/wix-proxy/event-bookings'", to: "'/api/postgres/events/${eventoId}/bookings?includeStudent=true'" },
  { from: '/api/wix-proxy/calendario-eventos', to: '/api/postgres/events/filtered' },
  { from: '/api/wix-proxy/create-class-event', to: '/api/postgres/events' },
  { from: '/api/wix-proxy/update-calendario-event', to: '/api/postgres/events' },
  { from: '/api/wix-proxy/delete-calendario-event/', to: '/api/postgres/events/' },
  { from: '/api/wix-proxy/calendario-events', to: '/api/postgres/calendar/events' },
  { from: '/api/wix-proxy/welcome-events', to: '/api/postgres/events/welcome' },
  { from: '/api/wix-proxy/all-sessions', to: '/api/postgres/events/sessions' },
  { from: '/api/wix-proxy/eventos-inscritos-batch', to: '/api/postgres/events/batch-counts' },

  // Advisor Operations
  { from: '/api/wix-proxy/advisor-by-email', to: '/api/postgres/advisors/by-email' },
  { from: '/api/wix-proxy/calendario-events-by-advisor', to: '/api/postgres/advisors' }, // Needs ID
  { from: '/api/wix-proxy/advisor-stats', to: '/api/postgres/advisors' }, // Needs ID/stats
  { from: '/api/wix-proxy/advisor-name', to: '/api/postgres/advisors' }, // Needs ID/name
  { from: '/api/wix-proxy/advisors', to: '/api/postgres/advisors' },

  // Student Academic
  { from: '/api/wix-proxy/student-by-id', to: '/api/postgres/students' },
  { from: '/api/wix-proxy/level-steps', to: '/api/postgres/niveles' }, // Needs codigo/steps
  { from: '/api/wix-proxy/update-student-step', to: '/api/postgres/students' }, // Needs id/step
  { from: '/api/wix-proxy/step-override', to: '/api/postgres/students' }, // Needs id/step-override
  { from: '/api/wix-proxy/academica-user', to: '/api/postgres/academic/user' },
  { from: '/api/wix-proxy/generate-student-activity', to: '/api/postgres/academic/activity' },
  { from: '/api/wix-proxy/update-class-record', to: '/api/postgres/academic' }, // Needs id
  { from: '/api/wix-proxy/update-class?id=', to: '/api/postgres/academic/' },
  { from: '/api/wix-proxy/delete-class?id=', to: '/api/postgres/academic/' },
  { from: '/api/wix-proxy/student-progress', to: '/api/postgres/students' }, // Needs id/progress

  // Comments
  { from: '/api/wix-proxy/person-comments', to: '/api/postgres/people' }, // Needs id/comments
  { from: '/api/wix-proxy/add-comment', to: '/api/postgres/people' }, // Needs id/comments

  // Contracts & Financial
  { from: '/api/wix-proxy/create-person', to: '/api/postgres/people' },
  { from: '/api/wix-proxy/create-financial', to: '/api/postgres/financial' },
  { from: '/api/wix-proxy/contracts-by-pattern', to: '/api/postgres/contracts/search' },
  { from: '/api/wix-proxy/extend-vigencia', to: '/api/postgres/students' }, // Needs id/extend
  { from: '/api/wix-proxy/toggle-contract-status', to: '/api/postgres/students' }, // Needs id/toggle-status
  { from: '/api/wix-proxy/create-contract', to: '/api/postgres/contracts' },

  // Approvals
  { from: '/api/wix-proxy/pending-approvals', to: '/api/postgres/approvals/pending' },
  { from: '/api/wix-proxy/update-aprobacion', to: '/api/postgres/approvals' }, // Needs id

  // Service
  { from: '/api/wix-proxy/beneficiarios-sin-registro', to: '/api/postgres/people/beneficiarios-sin-registro' },

  // Materials
  { from: '/api/wix-proxy/material-usuario', to: '/api/postgres/materials/usuario' },
  { from: '/api/wix-proxy/nivel-material', to: '/api/postgres/materials/nivel' },

  // Roles & Permissions
  { from: '/api/wix-proxy/role-permissions', to: '/api/postgres/roles' }, // Needs rol/permissions
  { from: '/api/wix-proxy/create-role', to: '/api/postgres/roles' },
  { from: '/api/wix-proxy/all-roles', to: '/api/postgres/roles' },

  // Other
  { from: '/api/wix-proxy/niveles', to: '/api/postgres/niveles' },
  { from: '/api/wix-proxy/toggle-student-onhold', to: '/api/postgres/students/onhold' },
];

// Archivos a actualizar
const FILES_TO_UPDATE = [
  'src/app/sesion/[id]/page.tsx',
  'src/app/dashboard/aprobacion/page.tsx',
  'src/app/dashboard/comercial/crear-contrato/page.tsx',
  'src/components/advisors/AdvisorsStatistics.tsx',
  'src/components/session/SessionMaterialTab.tsx',
  'src/components/calendar/EventModal.tsx',
  'src/app/dashboard/academic/agenda-sesiones/page.tsx',
  'src/components/advisor/AdvisorStats.tsx',
  'src/components/session/SessionStudentsTab.tsx',
  'src/components/advisor/AdvisorCalendar.tsx',
  'src/components/person/PersonComments.tsx',
  'src/components/person/PersonAdmin.tsx',
  'src/app/panel-advisor/page.tsx',
  'src/components/student/StudentComments.tsx',
  'src/app/dashboard/academic/agenda-academica/page.tsx',
  'src/components/student/StudentContract.tsx',
  'src/components/academic/EventDetailModal.tsx',
  'src/components/student/StudentProgress.tsx',
  'src/app/dashboard/academic/advisors/page.tsx',
  'src/components/student/StudentChangeStep.tsx',
  'src/app/dashboard/servicio/lista-sesiones/page.tsx',
  'src/components/student/StudentAcademic.tsx',
  'src/components/student/StudentOnHold.tsx',
  'src/app/dashboard/servicio/sin-registro/page.tsx',
  'src/app/dashboard/servicio/welcome-session/page.tsx',
  'src/lib/wix.ts',
  'src/config/roles.ts',
];

console.log('🚀 Iniciando migración de endpoints wix-proxy → postgres\n');

let totalFiles = 0;
let totalReplacements = 0;

FILES_TO_UPDATE.forEach((file) => {
  const filePath = path.join(__dirname, file);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Archivo no encontrado: ${file}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let fileReplacements = 0;

  ENDPOINT_MAPPINGS.forEach((mapping) => {
    const regex = new RegExp(mapping.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = content.match(regex);

    if (matches) {
      content = content.replace(regex, mapping.to);
      fileReplacements += matches.length;
    }
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${file} - ${fileReplacements} reemplazos`);
    totalFiles++;
    totalReplacements += fileReplacements;
  } else {
    console.log(`⏭️  ${file} - sin cambios`);
  }
});

console.log(`\n📊 Resumen:`);
console.log(`   Archivos actualizados: ${totalFiles}`);
console.log(`   Total de reemplazos: ${totalReplacements}`);
console.log(`\n✨ Migración completada!`);
