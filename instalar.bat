@echo off
title Instalador Mundial 2026
echo ============================================
echo   Verificando requisitos - Mundial 2026
echo ============================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js no esta instalado en este equipo.
    start https://nodejs.org/es/download
    echo Por favor instala Node.js y luego vuelve a ejecutar este instalador.
    pause
    exit /b 1
)

echo Node.js detectado correctamente.
echo.

cd /d "%~dp0"
echo Directorio actual: %cd%
echo.

REM Elimina cualquier node_modules previo (puede venir incompleto o de otro SO)
if exist "node_modules" (
    echo Eliminando node_modules previo para una instalacion limpia...
    rmdir /s /q "node_modules"
)

REM Elimina package-lock.json viejo por si referencia versiones incompatibles
if exist "package-lock.json" (
    del /f /q "package-lock.json"
)

echo Instalando dependencias (esto puede tardar unos minutos)...
call npm install

if %errorlevel% neq 0 (
    echo.
    echo ============================================
    echo   ERROR: npm install fallo
    echo ============================================
    echo Revisa el mensaje de error arriba.
    pause
    exit /b 1
)

if not exist "node_modules\express" (
    echo.
    echo ADVERTENCIA: node_modules\express no se encontro despues de npm install.
    echo Revisa que package.json incluya "express" en sus dependencias.
    pause
    exit /b 1
)

echo Dependencias instaladas correctamente.
echo.

echo Configurando conexion a la base de datos...
(
    echo DB_HOST=tokaido.proxy.rlwy.net
    echo DB_PORT=40676
    echo DB_USER=root
    echo DB_PASSWORD=vLNDkiyNPLijPMfwdDcVsIIkwsquAdNy
    echo DB_NAME=railway
) > "js\.env"

echo.
echo ============================================
echo   Instalacion completada correctamente
echo ============================================
pause