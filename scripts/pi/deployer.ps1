<#
.SYNOPSIS
  Construit le calculateur et le publie sur le Raspberry Pi (à côté de MyPrism, sans y toucher).

.EXAMPLE
  .\scripts\pi\deployer.ps1                 # build + envoi + mise en ligne (sans redémarrer de service)
  .\scripts\pi\deployer.ps1 -Retour         # revient à la version précédente sur le Pi
  .\scripts\pi\deployer.ps1 -Remarques      # installe ou met à jour le service des remarques (sans le redémarrer)
  .\scripts\pi\deployer.ps1 -Installer -TunnelId <id>   # (re)installe nginx + le tunnel, puis publie
#>
param(
  [switch]$Retour,
  [switch]$Remarques,
  [switch]$Installer,
  [string]$TunnelId,
  [string]$Pi = "myprism@myprism.local"
)
$ErrorActionPreference = "Stop"
# Accents corrects même lancé via « npm run deploy » (console en page de code OEM).
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$racine = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$envoi = "~/industrialist-envoi"

function Lancer([string]$quoi, [scriptblock]$bloc) {
  Write-Host "== $quoi" -ForegroundColor Cyan
  # Windows PowerShell 5.1 transforme tout message d'un programme sur sa sortie d'erreur
  # (ex. « nginx -t : syntax is ok ») en erreur fatale : on ne juge que le code de retour.
  $avant = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try { & $bloc 2>&1 | ForEach-Object { "$_" } } finally { $ErrorActionPreference = $avant }
  if ($LASTEXITCODE -ne 0) { throw "Échec : $quoi (code $LASTEXITCODE)" }
}

if ($Retour) {
  Lancer "Retour à la version précédente" { ssh $Pi "sudo industrialist-publier --retour" }
  return
}

Push-Location $racine
try {
  Lancer "Tests" { npm test --silent }
  if (-not $Remarques) { Lancer "Build" { npm run build --silent } }
} finally { Pop-Location }

if ($Remarques) {
  # Service des remarques (S34) : code et unité mis en place, mais rien n'est démarré ni rechargé (voir la fin).
  $code = Get-ChildItem (Join-Path $racine "server\*.ts") | Where-Object { $_.Name -notlike "*.test.ts" } | ForEach-Object { $_.FullName }
  Lancer "Envoi du service des remarques" {
    ssh $Pi "rm -rf $envoi-remarques && mkdir -p $envoi-remarques/server"
    if ($LASTEXITCODE -ne 0) { return }
    scp -q $code "${Pi}:$envoi-remarques/server/"
    if ($LASTEXITCODE -ne 0) { return }
    scp -q (Join-Path $racine "scripts\pi\remarques.sh") (Join-Path $racine "scripts\pi\controle-myprism.sh") "${Pi}:$envoi-remarques/"
  }
  Lancer "Installation du service des remarques" { ssh $Pi "sudo bash $envoi-remarques/remarques.sh $envoi-remarques" }
  return
}

Lancer "Envoi vers le Pi" {
  ssh $Pi "rm -rf $envoi && mkdir -p $envoi"
  if ($LASTEXITCODE -ne 0) { return }
  scp -q -r (Join-Path $racine "dist") (Join-Path $racine "scripts\pi\installer.sh") (Join-Path $racine "scripts\pi\publier.sh") "${Pi}:$envoi/"
}

if ($Installer) {
  if (-not $TunnelId) { throw "-Installer demande -TunnelId (voir HEBERGEMENT.md)." }
  $identifiants = Join-Path $env:USERPROFILE ".cloudflared\$TunnelId.json"
  if (-not (Test-Path $identifiants)) { throw "Identifiants du tunnel introuvables : $identifiants" }
  # Les identifiants transitent par un dossier en 700 (jamais en argument de commande),
  # supprimé aussitôt après l'installation.
  Lancer "Envoi des identifiants du tunnel" {
    ssh $Pi "mkdir -m 700 $envoi/secret"
    if ($LASTEXITCODE -ne 0) { return }
    scp -q $identifiants "${Pi}:$envoi/secret/tunnel.json"
  }
  Lancer "Installation (nginx + tunnel)" {
    ssh $Pi "sudo bash $envoi/installer.sh $TunnelId $envoi/secret/tunnel.json; code=`$?; rm -rf $envoi/secret; exit `$code"
  }
}

Lancer "Mise en ligne" { ssh $Pi "sudo industrialist-publier $envoi/dist && rm -rf $envoi" }
Write-Host "En ligne : https://industrialist.myprisme.fr  (réseau local : http://myprism.local:8090)" -ForegroundColor Green
