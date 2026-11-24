@echo off
setlocal
title Planificateur Industrialist - deploiement
cd /d "%~dp0"

:menu
echo.
echo   Planificateur Industrialist
echo   ---------------------------
echo   1. Deployer le site (tests, build, envoi sur le Pi)
echo   2. Revenir a la version precedente
echo   3. Lister les versions du Pi
echo   4. Quitter
echo.
choice /c 1234 /n /m "Choix : "
if errorlevel 4 exit /b 0
if errorlevel 3 goto liste
if errorlevel 2 goto retour
if errorlevel 1 goto deployer
exit /b 1

:deployer
rem Garde-fous : ne jamais mettre en ligne un site plus ancien ou du travail non enregistre.
for /f "delims=" %%b in ('git branch --show-current') do set "BRANCHE=%%b"
if not "%BRANCHE%"=="main" (
  echo ARRET : branche "%BRANCHE%", il faut etre sur main.
  goto fin
)
git diff --quiet HEAD
if errorlevel 1 (
  echo ARRET : modifications non commitees :
  git status --short -uno
  goto fin
)
git fetch --quiet origin
if errorlevel 1 (
  echo ARRET : GitHub injoignable, impossible de verifier que main est a jour.
  goto fin
)
git merge-base --is-ancestor origin/main HEAD
if errorlevel 1 (
  echo ARRET : GitHub a des commits que ce dossier n'a pas. Lance d'abord : git pull
  goto fin
)
echo.
git log -1 --format="A mettre en ligne : %%h %%s"
choice /c ON /n /m "Deployer ? (O/N) "
if errorlevel 2 goto menu
call npm run deploy
if errorlevel 1 (
  echo.
  echo ECHEC du deploiement : lis le message ci-dessus.
  git status --short -uno
  goto fin
)
git commit -m "Version en ligne" -- package.json package-lock.json
if errorlevel 1 (
  echo Site en ligne, mais le numero de version n'a pas pu etre commite.
  goto fin
)
choice /c ON /n /m "Pousser main sur GitHub ? (O/N) "
if errorlevel 2 goto fin
git push origin main
if errorlevel 1 echo Site en ligne, mais main n'a pas pu etre pousse.
goto fin

:retour
choice /c ON /n /m "Remettre la version precedente en ligne ? (O/N) "
if errorlevel 2 goto menu
call npm run deploy:retour
if errorlevel 1 echo ECHEC du retour en arriere.
goto fin

:liste
ssh myprism@myprism.local "sudo industrialist-publier --liste"
if errorlevel 1 echo ECHEC : Pi injoignable.
goto fin

:fin
echo.
pause
exit /b
