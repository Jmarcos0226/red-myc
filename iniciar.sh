#!/bin/bash

echo ""
echo "============================================"
echo "  Red de Emprendedores MYC"
echo "  Misión y Comunión"
echo "============================================"
echo ""

# Check Python
if ! command -v python3 &>/dev/null; then
  echo "[ERROR] Python3 no encontrado."
  echo "Instálalo desde: https://www.python.org/downloads/"
  exit 1
fi

# Check Flask
python3 -c "import flask" 2>/dev/null
if [ $? -ne 0 ]; then
  echo "Instalando Flask..."
  pip3 install flask
fi

echo "Iniciando servidor en http://localhost:3000"
echo "Presiona Ctrl+C para detener"
echo ""
echo "Cuentas de acceso:"
echo "  Admin:    admin@myc.org   / admin123"
echo "  Manager:  manager@myc.org / manager123"
echo "  Demo:     ana@myc.org     / pass123"
echo ""

# Open browser
sleep 2 && (open http://localhost:3000 2>/dev/null || xdg-open http://localhost:3000 2>/dev/null) &

python3 server.py
