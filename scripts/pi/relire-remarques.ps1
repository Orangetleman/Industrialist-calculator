<#
.SYNOPSIS
  Relit les dernières remarques par l'accès réservé (en attendant le tableau de bord de S36).
  Le mot de passe est demandé masqué ; il n'est ni affiché ni gardé.

.EXAMPLE
  .\scripts\pi\relire-remarques.ps1                                  # en ligne
  .\scripts\pi\relire-remarques.ps1 -Adresse http://localhost:5173   # en local (npm run remarques + npm run dev)
#>
param(
  [string]$Adresse = "https://industrialist.myprisme.fr",
  [int]$Nombre = 10
)
$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$secret = Read-Host "Mot de passe du tableau de bord" -AsSecureString
$clair = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret))
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$entetes = @{ Origin = $Adresse }
try {
  $corps = @{ motDePasse = $clair } | ConvertTo-Json -Compress
  Invoke-RestMethod "$Adresse/api/admin/connexion" -Method Post -Body ([Text.Encoding]::UTF8.GetBytes($corps)) -ContentType "application/json" -Headers $entetes -WebSession $session | Out-Null
} catch {
  Write-Host "Connexion refusée : $($_.Exception.Message)" -ForegroundColor Red
  exit 1
} finally { $clair = $null }

$liste = Invoke-RestMethod "$Adresse/api/admin/remarques" -WebSession $session
Write-Host "$(@($liste).Count) remarque(s), les $Nombre dernières :" -ForegroundColor Cyan
@($liste) | Select-Object -First $Nombre | ForEach-Object {
  [pscustomobject]@{ n = $_.id; quand = [DateTimeOffset]::FromUnixTimeMilliseconds($_.cree).LocalDateTime; type = $_.type; etat = $_.etat; page = $_.page; texte = $_.texte }
} | Format-Table -AutoSize -Wrap
Invoke-RestMethod "$Adresse/api/admin/deconnexion" -Method Post -Headers $entetes -WebSession $session | Out-Null
