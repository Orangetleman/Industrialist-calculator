<#
.SYNOPSIS
  Choisit le mot de passe du tableau de bord des remarques (npm run remarques:mot-de-passe).
  Il est tapé ici, sur le PC (une * par caractère), haché par scrypt sur le PC (server/hacher.ts), et seule la
  ligne hachée part vers le Pi. Le mot de passe en clair ne quitte jamais le PC et n'est gardé nulle part.
#>
param([string]$Pi = "myprism@myprism.local")
$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$racine = Resolve-Path (Join-Path $PSScriptRoot "..\..")

function Lire([string]$question) {
  $s = Read-Host $question -AsSecureString
  $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}

$un = Lire "Mot de passe du tableau de bord (10 caractères au moins)"
$deux = Lire "Encore une fois"
if ($un -cne $deux) { Write-Host "Les deux ne sont pas identiques : rien n'a changé." -ForegroundColor Red; exit 1 }
if ($un.Length -lt 10) { Write-Host "Trop court ($($un.Length) caractères) : rien n'a changé." -ForegroundColor Red; exit 1 }

# Hachage sur le PC : le mot de passe passe par l'entrée standard de Node (jamais en argument).
$info = New-Object System.Diagnostics.ProcessStartInfo
$info.FileName = "node"
$info.Arguments = "--disable-warning=ExperimentalWarning `"$(Join-Path $racine 'server\hacher.ts')`""
$info.UseShellExecute = $false
$info.RedirectStandardInput = $true
$info.RedirectStandardOutput = $true
$node = [System.Diagnostics.Process]::Start($info)
$entree = New-Object System.IO.StreamWriter($node.StandardInput.BaseStream, (New-Object System.Text.UTF8Encoding($false)))
$entree.Write($un)
$entree.Close()
$un = $null; $deux = $null
$ligne = $node.StandardOutput.ReadToEnd().Trim()
$node.WaitForExit()
if ($node.ExitCode -ne 0 -or $ligne -notmatch '^scrypt\$') { Write-Host "Hachage impossible : rien n'a changé." -ForegroundColor Red; exit 1 }

$ligne | ssh $Pi "sudo industrialist-remarques-mot-de-passe --ligne"
if ($LASTEXITCODE -ne 0) { Write-Host "Envoi au Pi impossible." -ForegroundColor Red; exit 1 }
