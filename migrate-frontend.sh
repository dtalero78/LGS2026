#!/bin/bash

# Script para migrar TODOS los endpoints del frontend de wix-proxy a postgres
# Uso: bash migrate-frontend.sh

echo "🚀 Iniciando migración masiva de endpoints..."
echo ""

# Contador
TOTAL_CHANGES=0

# Función para reemplazar en archivos
replace_in_files() {
    local pattern="$1"
    local replacement="$2"
    local description="$3"

    echo "📝 $description"

    # Buscar archivos que contengan el patrón
    local files=$(grep -rl "$pattern" src/ 2>/dev/null | grep -E '\.(tsx?|jsx?)$' | grep -v node_modules)

    if [ -z "$files" ]; then
        echo "   ⏭️  No se encontraron archivos"
        return
    fi

    local count=0
    while IFS= read -r file; do
        if [ -f "$file" ]; then
            # Hacer el reemplazo
            if [[ "$OSTYPE" == "darwin"* ]]; then
                # macOS
                sed -i '' "s|$pattern|$replacement|g" "$file"
            else
                # Linux
                sed -i "s|$pattern|$replacement|g" "$file"
            fi
            count=$((count + 1))
        fi
    done <<< "$files"

    echo "   ✅ Actualizado en $count archivo(s)"
    TOTAL_CHANGES=$((TOTAL_CHANGES + count))
    echo ""
}

# Event Management
replace_in_files \
    "/api/wix-proxy/calendario-event?id=" \
    "/api/postgres/events/" \
    "Eventos individuales"

replace_in_files \
    "/api/wix-proxy/calendario-eventos" \
    "/api/postgres/events/filtered" \
    "Eventos filtrados"

replace_in_files \
    "/api/wix-proxy/create-class-event" \
    "/api/postgres/events" \
    "Crear eventos"

replace_in_files \
    "/api/wix-proxy/update-class" \
    "/api/postgres/academic" \
    "Actualizar clases"

replace_in_files \
    "/api/wix-proxy/delete-class" \
    "/api/postgres/academic" \
    "Eliminar clases"

replace_in_files \
    "/api/wix-proxy/calendario-events" \
    "/api/postgres/calendar/events" \
    "Lista de eventos calendario"

replace_in_files \
    "/api/wix-proxy/welcome-events" \
    "/api/postgres/events/welcome" \
    "Eventos Welcome"

replace_in_files \
    "/api/wix-proxy/all-sessions" \
    "/api/postgres/events/sessions" \
    "Todas las sesiones"

replace_in_files \
    "/api/wix-proxy/eventos-inscritos-batch" \
    "/api/postgres/events/batch-counts" \
    "Conteos batch de eventos"

# Advisor Operations
replace_in_files \
    "/api/wix-proxy/advisor-by-email" \
    "/api/postgres/advisors/by-email" \
    "Buscar advisor por email"

replace_in_files \
    "/api/wix-proxy/advisor-name" \
    "/api/postgres/advisors" \
    "Nombre de advisor"

replace_in_files \
    "/api/wix-proxy/advisor-stats" \
    "/api/postgres/advisors" \
    "Estadísticas de advisor"

replace_in_files \
    "/api/wix-proxy/advisors" \
    "/api/postgres/advisors" \
    "Lista de advisors"

# Student Academic
replace_in_files \
    "/api/wix-proxy/student-by-id" \
    "/api/postgres/students" \
    "Estudiante por ID"

replace_in_files \
    "/api/wix-proxy/level-steps" \
    "/api/postgres/niveles" \
    "Steps del nivel"

replace_in_files \
    "/api/wix-proxy/update-student-step" \
    "/api/postgres/students" \
    "Actualizar step estudiante"

replace_in_files \
    "/api/wix-proxy/step-override" \
    "/api/postgres/students" \
    "Overrides de steps"

replace_in_files \
    "/api/wix-proxy/academica-user" \
    "/api/postgres/academic/user" \
    "Usuario académico"

replace_in_files \
    "/api/wix-proxy/generate-student-activity" \
    "/api/postgres/academic/activity" \
    "Actividad del estudiante"

replace_in_files \
    "/api/wix-proxy/update-class-record" \
    "/api/postgres/academic" \
    "Actualizar registro de clase"

replace_in_files \
    "/api/wix-proxy/student-progress" \
    "/api/postgres/students" \
    "Progreso del estudiante"

# Comments
replace_in_files \
    "/api/wix-proxy/person-comments" \
    "/api/postgres/people" \
    "Comentarios de persona"

replace_in_files \
    "/api/wix-proxy/add-comment" \
    "/api/postgres/people" \
    "Agregar comentario"

# Contracts & Financial
replace_in_files \
    "/api/wix-proxy/create-person" \
    "/api/postgres/people" \
    "Crear persona"

replace_in_files \
    "/api/wix-proxy/create-financial" \
    "/api/postgres/financial" \
    "Crear registro financiero"

replace_in_files \
    "/api/wix-proxy/contracts-by-pattern" \
    "/api/postgres/contracts/search" \
    "Buscar contratos"

replace_in_files \
    "/api/wix-proxy/extend-vigencia" \
    "/api/postgres/students" \
    "Extender vigencia"

replace_in_files \
    "/api/wix-proxy/toggle-contract-status" \
    "/api/postgres/students" \
    "Toggle estado contrato"

replace_in_files \
    "/api/wix-proxy/create-contract" \
    "/api/postgres/contracts" \
    "Crear contrato"

# Approvals
replace_in_files \
    "/api/wix-proxy/pending-approvals" \
    "/api/postgres/approvals/pending" \
    "Aprobaciones pendientes"

replace_in_files \
    "/api/wix-proxy/update-aprobacion" \
    "/api/postgres/approvals" \
    "Actualizar aprobación"

# Service
replace_in_files \
    "/api/wix-proxy/beneficiarios-sin-registro" \
    "/api/postgres/people/beneficiarios-sin-registro" \
    "Beneficiarios sin registro"

# Materials
replace_in_files \
    "/api/wix-proxy/material-usuario" \
    "/api/postgres/materials/usuario" \
    "Material de usuario"

replace_in_files \
    "/api/wix-proxy/nivel-material" \
    "/api/postgres/materials/nivel" \
    "Material del nivel"

# Roles & Permissions
replace_in_files \
    "/api/wix-proxy/role-permissions" \
    "/api/postgres/roles" \
    "Permisos de rol"

replace_in_files \
    "/api/wix-proxy/create-role" \
    "/api/postgres/roles" \
    "Crear rol"

replace_in_files \
    "/api/wix-proxy/all-roles" \
    "/api/postgres/roles" \
    "Todos los roles"

# Other
replace_in_files \
    "/api/wix-proxy/niveles" \
    "/api/postgres/niveles" \
    "Niveles"

replace_in_files \
    "/api/wix-proxy/toggle-student-onhold" \
    "/api/postgres/students/onhold" \
    "Toggle OnHold estudiante"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 RESUMEN:"
echo "   Total de archivos modificados: $TOTAL_CHANGES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✨ Migración completada!"
echo ""
echo "⚠️  NOTA: Algunos endpoints requieren ajustes manuales:"
echo "   - event-bookings necesita eventoId en la URL"
echo "   - Algunos endpoints necesitan IDs dinámicos"
echo "   - Verificar métodos HTTP (GET/POST/PUT/DELETE)"
echo ""
echo "🔍 Revisa los archivos modificados para ajustes finales"
