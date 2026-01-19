#!/bin/bash

# Script para corregir el permiso de TALERO en Wix
# El problema: Wix tiene ["undefined"] en lugar de ["ACADEMICO.ADVISOR.LISTA_VER"]

echo "🔧 Corrigiendo permiso de TALERO en Wix..."
echo ""

# Verificar estado actual
echo "1️⃣ Estado ACTUAL en Wix:"
curl -s "https://www.lgsplataforma.com/_functions/rolePermissions?rol=TALERO" | jq '.permisos'
echo ""

# Preparar payload correcto
PAYLOAD='{
  "rol": "TALERO",
  "permisos": ["ACADEMICO.ADVISOR.LISTA_VER"]
}'

echo "2️⃣ Enviando corrección a Wix..."
echo "Payload:"
echo "$PAYLOAD" | jq '.'
echo ""

# Enviar actualización
RESPONSE=$(curl -s -X POST "https://www.lgsplataforma.com/_functions/updateRolePermissions" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

echo "3️⃣ Respuesta de Wix:"
echo "$RESPONSE" | jq '.'
echo ""

# Verificar que se aplicó
echo "4️⃣ Verificando cambio aplicado:"
sleep 2
curl -s "https://www.lgsplataforma.com/_functions/rolePermissions?rol=TALERO" | jq '.'
echo ""

echo "✅ Script completado!"
echo ""
echo "📋 Siguiente paso:"
echo "   Haz logout y login como TALERO para que el cache se refresque"
