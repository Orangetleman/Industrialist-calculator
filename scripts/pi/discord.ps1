<#
.SYNOPSIS
  Range sur le Pi l'adresse du webhook du salon Discord réservé (npm run remarques:discord), pour que chaque
  remarque nouvelle y poste un message (S35). L'adresse est collée ici, masquée, et part vers le Pi par l'entrée
  standard de ssh (jamais en argument de commande). Elle n'est affichée nulle part.

.EXAMPLE
  npm run remarques:discord                  # colle l'adresse (Discord : Modifier le salon › Intégrations › Webhooks)
  npm run remarques:discord -- -Retirer      # plus de message Discord
#>
param([switch]$Retirer, [string]$Pi = "myprism@myprism.local")
$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

if ($Retirer) {
  ssh $Pi "sudo industrialist-remarques-discord --retirer"
  exit $LASTEXITCODE
}

$s = Read-Host "Adresse du webhook Discord (Copier l'URL du webhook, puis coller ici)" -AsSecureString
$b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
try { $adresse = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b).Trim() } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
if ($adresse -notmatch '^https://(canary\.|ptb\.)?discord(app)?\.com/api/webhooks/\d+/[A-Za-z0-9_-]+$') {
  Write-Host "Ce n'est pas une adresse de webhook Discord : rien n'a changé." -ForegroundColor Red
  exit 1
}
$adresse | ssh $Pi "sudo industrialist-remarques-discord"
$code = $LASTEXITCODE
$adresse = $null
if ($code -ne 0) { Write-Host "Envoi au Pi impossible." -ForegroundColor Red; exit 1 }
