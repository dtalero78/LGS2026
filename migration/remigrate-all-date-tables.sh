#!/bin/bash

echo "🚀 Re-migrating tables with date fields"
echo "========================================"
echo ""

tables=(
  "04-people.js"
  "05-academica.js"
  "07-academica-bookings.js"
  "08-financieros.js"
)

for table in "${tables[@]}"; do
  echo "📋 Starting migration: $table"
  echo "----------------------------------------"
  node "exporters/$table"
  exit_code=$?

  if [ $exit_code -eq 0 ]; then
    echo "✅ $table completed successfully"
  else
    echo "❌ $table failed with exit code $exit_code"
  fi
  echo ""
  echo "========================================"
  echo ""
done

echo "✅ All migrations complete!"
