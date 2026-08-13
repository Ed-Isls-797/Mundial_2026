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

if exist "node_modules" (
    echo.
    echo ============================================
    echo   ERROR: no se pudo eliminar node_modules
    echo ============================================
    echo Puede ser un problema de permisos de escritura en esta carpeta.
    echo Cierra cualquier proceso que lo este usando e intenta de nuevo.
    pause
    exit /b 1
)

echo Instalando dependencias (esto puede tardar unos minutos)...
if exist "package-lock.json" (
    REM npm ci: instalacion limpia y determinista basada en package-lock.json
    call npm ci
) else (
    call npm install
)

if %errorlevel% neq 0 (
    echo.
    echo ============================================
    echo   ERROR: la instalacion de dependencias fallo
    echo ============================================
    echo Revisa el mensaje de error arriba.
    pause
    exit /b 1
)

set FALTAN_DEPENDENCIAS=0
for %%D in (express mysql2 cors dotenv) do (
    if not exist "node_modules\%%D" (
        echo ADVERTENCIA: node_modules\%%D no se encontro despues de la instalacion.
        set FALTAN_DEPENDENCIAS=1
    )
)

if "%FALTAN_DEPENDENCIAS%"=="1" (
    echo.
    echo Revisa que package.json incluya todas las dependencias necesarias.
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