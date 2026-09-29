@echo off
chcp 65001 >nul
title Installation de Streak Chat
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js n'est pas installe. Installe la version LTS depuis https://nodejs.org
  echo puis relance ce fichier.
  echo.
  pause
  exit /b 1
)

echo.
echo [1/3] Telechargement des composants (quelques minutes la premiere fois)...
call npm install
if errorlevel 1 goto erreur

echo.
echo [2/3] Creation de l'application...
call npm run package
if errorlevel 1 goto erreur

echo.
echo [3/3] Installation dans %LOCALAPPDATA%\StreakChat ...
taskkill /im StreakChat.exe /f >nul 2>nul
timeout /t 1 /nobreak >nul
if exist "%LOCALAPPDATA%\StreakChat" rmdir /s /q "%LOCALAPPDATA%\StreakChat"
xcopy /e /i /y /q "dist\StreakChat-win32-x64" "%LOCALAPPDATA%\StreakChat" >nul
if errorlevel 1 goto erreur

rem Lancement via l'Explorateur : le widget vit sa vie, meme si on ferme cette fenetre
explorer.exe "%LOCALAPPDATA%\StreakChat\StreakChat.exe"
echo.
echo Termine ! Le chat est en bas a droite de ton ecran et se lancera tout seul
echo a chaque ouverture de session Windows. Tu peux fermer cette fenetre.
echo.
pause
exit /b 0

:erreur
echo.
echo Oups, quelque chose s'est mal passe. Copie le message ci-dessus et envoie-le moi.
pause
exit /b 1
