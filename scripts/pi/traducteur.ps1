<#
.SYNOPSIS
  Range sur le Pi la clé DeepL de l'auteur (npm run remarques:traducteur), pour la traduction automatique du tableau
  de bord (S36). La clé est collée ici, masquée, et part vers le Pi par l'entrée standard de ssh (jamais en argument
  de commande). Elle n'est affichée nulle part.

.EXAMPLE
  npm run remarques:traducteur                  # colle la clé (DeepL : Compte › Clés API › Copier)
  npm run remarques:traducteur -- -Retirer      # plus de traduction automatique
#>
param([switch]$Retirer, [string]$Pi = "myprism@myprism.local")
$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

if ($Retirer) {
  ssh $Pi "sudo industrialist-remarques-traducteur --retirer"
  exit $LASTEXITCODE
}

$s = Read-Host "Clé de l'API DeepL (copier dans ton compte DeepL, puis coller ici)" -AsSecureString
$b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
try { $cle = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b).Trim() } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
if ($cle -notmatch '^[A-Za-z0-9-]{20,80}(:fx)?$') {
  Write-Host "Ce n'est pas une clé DeepL : rien n'a changé." -ForegroundColor Red
  exit 1
}
$cle | ssh $Pi "sudo industrialist-remarques-traducteur"
$code = $LASTEXITCODE
$cle = $null
if ($code -ne 0) { Write-Host "Envoi au Pi impossible." -ForegroundColor Red; exit 1 }
