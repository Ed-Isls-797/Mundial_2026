@echo off
title Mundial 2026 - Servidor
echo ============================================
echo   Iniciando Mundial 2026...
echo ============================================
echo.

cd /d "%~dp0"

if not exist "node_modules" (
    echo Instalando dependencias por primera vez, esto puede tardar unos minutos...
    call npm install
)

if not exist "js\.env" (
    echo ADVERTENCIA: no se encontro js\.env, ejecuta instalar.bat primero.
    pause
    exit /b 1
)

REM Inicia el servidor SIN minimizar, para poder ver errores si algo falla
start "Servidor Mundial 2026" cmd /k "node js\server.js"

REM Espera a que el servidor levante
timeout /t 3 /nobreak > nul

REM Abre el navegador automáticamente
start http://localhost:3000/html/simulacion.html

echo.
echo El sistema esta corriendo. NO CIERRES la ventana "Servidor Mundial 2026".
echo Si ves un error ahi, revisalo antes de continuar.
timeout /t 5