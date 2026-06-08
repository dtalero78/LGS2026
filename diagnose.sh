#!/usr/bin/env bash
#
# diagnose.sh - DiagnÃ³stico de demoras en respuesta HTTP/HTTPS
# Mide dÃ³nde se va el tiempo: DNS, conexiÃ³n TCP, handshake TLS, TTFB y total.
#
# Uso:
#   ./diagnose.sh                       # usa https://lgs-plataform.com por defecto
#   ./diagnose.sh https://otro-sitio    # otra URL
#   ./diagnose.sh https://lgs-plataform.com 10   # 10 muestras (por defecto 5)
#

set -u

URL="${1:-https://lgs-plataform.com}"
SAMPLES="${2:-5}"

# Extrae el host (sin esquema ni path) para ping/DNS
HOST="$(printf '%s' "$URL" | sed -E 's#^https?://##; s#/.*$##; s#:.*$##')"

echo "=================================================="
echo " DiagnÃ³stico para: $URL"
echo " Host:             $HOST"
echo " Muestras:         $SAMPLES"
echo " Fecha:            $(date)"
echo "=================================================="

# ---------------------------------------------------------------------------
# 1) ResoluciÃ³n DNS
# ---------------------------------------------------------------------------
echo
echo "----- 1) DNS -----"
if command -v dig >/dev/null 2>&1; then
  dig +short "$HOST"
  echo "Tiempo de query DNS:"
  dig "$HOST" | grep "Query time" || true
elif command -v nslookup >/dev/null 2>&1; then
  nslookup "$HOST"
else
  echo "(dig/nslookup no disponibles; saltando)"
fi

# ---------------------------------------------------------------------------
# 2) Ping (latencia de red al servidor)
# ---------------------------------------------------------------------------
echo
echo "----- 2) PING -----"
if command -v ping >/dev/null 2>&1; then
  # -c 4 = 4 paquetes (Linux/macOS). En Git Bash de Windows puede variar.
  ping -c 4 "$HOST" 2>/dev/null || ping -n 4 "$HOST" 2>/dev/null || echo "(ping bloqueado o no disponible)"
else
  echo "(ping no disponible)"
fi

# ---------------------------------------------------------------------------
# 3) Desglose de tiempos con curl
# ---------------------------------------------------------------------------
echo
echo "----- 3) DESGLOSE DE TIEMPOS (curl) -----"
printf "%-3s | %-9s | %-9s | %-9s | %-9s | %-9s | %-5s\n" \
  "#" "DNS(s)" "Connect" "TLS" "TTFB" "Total" "HTTP"
printf -- "----+-----------+-----------+-----------+-----------+-----------+------\n"

# Acumuladores para promedios
sum_dns=0; sum_conn=0; sum_tls=0; sum_ttfb=0; sum_total=0
ok=0

for i in $(seq 1 "$SAMPLES"); do
  # Campos de tiempo que reporta curl (en segundos)
  read -r t_dns t_conn t_app t_ttfb t_total http_code <<EOF
$(curl -s -o /dev/null \
    -w '%{time_namelookup} %{time_connect} %{time_appconnect} %{time_starttransfer} %{time_total} %{http_code}' \
    --max-time 30 \
    "$URL")
EOF

  # time_appconnect = 0 si no hay TLS (http simple)
  printf "%-3s | %-9s | %-9s | %-9s | %-9s | %-9s | %-5s\n" \
    "$i" "$t_dns" "$t_conn" "$t_app" "$t_ttfb" "$t_total" "$http_code"

  # Suma para promedio (usa awk para float)
  sum_dns=$(awk "BEGIN{print $sum_dns + $t_dns}")
  sum_conn=$(awk "BEGIN{print $sum_conn + $t_conn}")
  sum_tls=$(awk "BEGIN{print $sum_tls + $t_app}")
  sum_ttfb=$(awk "BEGIN{print $sum_ttfb + $t_ttfb}")
  sum_total=$(awk "BEGIN{print $sum_total + $t_total}")
  ok=$((ok + 1))
  sleep 1
done

# ---------------------------------------------------------------------------
# 4) Promedios y lectura del resultado
# ---------------------------------------------------------------------------
echo
echo "----- 4) PROMEDIOS -----"
if [ "$ok" -gt 0 ]; then
  avg_dns=$(awk "BEGIN{printf \"%.3f\", $sum_dns/$ok}")
  avg_conn=$(awk "BEGIN{printf \"%.3f\", $sum_conn/$ok}")
  avg_tls=$(awk "BEGIN{printf \"%.3f\", $sum_tls/$ok}")
  avg_ttfb=$(awk "BEGIN{printf \"%.3f\", $sum_ttfb/$ok}")
  avg_total=$(awk "BEGIN{printf \"%.3f\", $sum_total/$ok}")

  echo "DNS promedio:                 ${avg_dns}s"
  echo "ConexiÃ³n TCP (acumulado):     ${avg_conn}s"
  echo "TLS handshake (acumulado):    ${avg_tls}s"
  echo "TTFB - 1er byte (acumulado):  ${avg_ttfb}s   <-- tiempo de procesamiento del servidor"
  echo "Total promedio:               ${avg_total}s"
  echo
  echo "CÃ³mo leerlo:"
  echo "  - Si TTFB es alto pero Connect/TLS son bajos  -> el cuello de botella estÃ¡"
  echo "    en TU servidor/app/base de datos (no en la red de DigitalOcean)."
  echo "  - Si Connect/TLS son altos -> problema de red, latencia o saturaciÃ³n de conexiÃ³n."
  echo "  - Si DNS es alto -> problema de resoluciÃ³n de dominio."
  echo "  - HTTP 5xx -> errores del servidor; 200 -> respondiÃ³ OK aunque lento."
else
  echo "No se completaron muestras."
fi

echo
echo "Listo."
