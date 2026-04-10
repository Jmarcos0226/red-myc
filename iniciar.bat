@echo off
echo.
echo  ============================================
echo   Red de Emprendedores MYC
echo   Mision y Comunion
echo  ============================================
echo.

:: Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python no encontrado.
    echo Descargalo desde: https://www.python.org/downloads/
    echo Asegurate de marcar "Add Python to PATH" al instalar.
    pause
    exit /b 1
)

:: Check Flask
python -c "import flask" >nul 2>&1
if %errorlevel% neq 0 (
    echo Instalando Flask...
    pip install flask
)

echo  Iniciando servidor en http://localhost:3000
echo  Presiona Ctrl+C para detener
echo.
echo  Cuentas de acceso:
echo    Admin:    admin@myc.org   / admin123
echo    Manager:  manager@myc.org / manager123
echo    Demo:     ana@myc.org     / pass123
echo.

:: Open browser after 2 seconds
start /b timeout /t 2 /nobreak >nul ^& start http://localhost:3000

python server.py
pause
