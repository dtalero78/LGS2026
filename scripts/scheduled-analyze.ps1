# scheduled-analyze.ps1
# Orquesta el ANALYZE programado: whitelist temporal de la IP -> ANALYZE -> remove IP.
# Pensado para correr desde el Programador de tareas de Windows. Registra todo en
# scripts/analyze-<timestamp>.log. El bloque finally SIEMPRE intenta quitar la IP.

$ErrorActionPreference = 'Stop'
$repo    = 'c:\Users\tddir\Documents\GRUPO J&J\X PLATAFORMA\LGS2026Git\LGS2026'
$cluster = '08d65733-6811-420c-a0a1-a71d6b3b9c6d'   # lgs-db
$log     = Join-Path $repo ('scripts\analyze-{0}.log' -f (Get-Date -Format 'yyyyMMdd-HHmmss'))

function W($m) { ('[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m) | Tee-Object -FilePath $log -Append }

# Resolver doctl y node aunque el PATH del task sea minimo
$doctl = (Get-Command doctl -ErrorAction SilentlyContinue).Source
if (-not $doctl) { $doctl = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\DigitalOcean.Doctl_Microsoft.Winget.Source_8wekyb3d8bbwe\doctl.exe" }
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { $node = 'node' }

Set-Location $repo
W "=== INICIO ANALYZE programado ==="
$ip = $null
try {
  $ip = (Invoke-RestMethod -Uri 'https://api.ipify.org?format=json' -TimeoutSec 15).ip
  W "IP publica: $ip"
  & $doctl databases firewalls append $cluster --rule "ip_addr:$ip" --output json 2>&1 | Out-Null
  W "IP agregada a Trusted Sources"
  Start-Sleep -Seconds 6   # propagacion del firewall
  W "Ejecutando run-analyze.js ..."
  $out = & $node "$repo\scripts\run-analyze.js" 2>&1
  $out | ForEach-Object { $_ | Tee-Object -FilePath $log -Append }
  W "run-analyze.js exit code: $LASTEXITCODE"
} catch {
  W "ERROR: $($_.Exception.Message)"
} finally {
  if ($ip) {
    try {
      $rule = (& $doctl databases firewalls list $cluster --output json 2>$null | ConvertFrom-Json) | Where-Object { $_.value -eq $ip }
      if ($rule) { & $doctl databases firewalls remove $cluster --uuid $rule.uuid --output json 2>&1 | Out-Null; W "IP removida de Trusted Sources" }
      else { W "AVISO: la IP ya no estaba en la lista" }
    } catch { W "ERROR removiendo IP (revisar manualmente): $($_.Exception.Message)" }
  }
  W "=== FIN ==="
}
