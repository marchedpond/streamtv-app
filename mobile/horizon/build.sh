#!/bin/bash
# ==============================================================================
# StreamTV — Nintendo Switch (.nro) Automated Build Script
# ==============================================================================

set -e

echo "----------------------------------------------------------------------"
echo "  Compilando cliente nativo StreamTV para Nintendo Switch (Horizon OS)"
echo "----------------------------------------------------------------------"

# Search common devkitPro installation paths on macOS / Linux
if [ -z "$DEVKITPRO" ]; then
    for path in "/opt/devkitpro" "/usr/local/devkitpro" "$HOME/devkitpro" "$HOME/opt/devkitpro"; do
        if [ -d "$path" ]; then
            export DEVKITPRO="$path"
            break
        fi
    done
fi

if [ -n "$DEVKITPRO" ]; then
    export PORTLIBS="$DEVKITPRO/portlibs"
    export LIBNX="$DEVKITPRO/libnx"
    export PATH="$DEVKITPRO/devkitA64/bin:$DEVKITPRO/tools/bin:$PATH"
fi

if [ -z "$DEVKITPRO" ]; then
    echo ""
    echo "======================================================================"
    echo " ⚠️  DEVKITPRO (toolchain de compilacion AArch64) no detectado."
    echo "======================================================================"
    echo ""
    echo " Ya descargamos el instalador oficial para macOS en:"
    echo "   /tmp/devkitpro-pacman-installer.pkg"
    echo ""
    echo " 📌 Ejecuta estos 2 comandos en tu Terminal para completar la instalacion:"
    echo ""
    echo " 1) Instalar devkitPro:"
    echo "    sudo installer -pkg /tmp/devkitpro-pacman-installer.pkg -target /"
    echo ""
    echo " 2) Instalar librerias de Nintendo Switch:"
    echo "    sudo dkp-pacman -S switch-dev switch-curl switch-mbedtls switch-zlib"
    echo ""
    echo " 3) Volver a compilar:"
    echo "    cd mobile/horizon && ./build.sh"
    echo "======================================================================"
    exit 1
fi

echo "[1/3] Entorno devkitPro detectado en: $DEVKITPRO"

# Execute clean make
echo "[2/3] Ejecutando Make..."
make clean || true
make -j$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 2)

echo "[3/3] Compilación finalizada exitosamente."

if [ -f "StreamTV.nro" ]; then
    echo ""
    echo "======================================================================"
    echo " ¡EXITO! Archivo ejecutable generado:"
    echo "   -> mobile/horizon/StreamTV.nro"
    echo "   -> mobile/horizon/StreamTV.nacp"
    echo ""
    echo " Instrucciones de Instalacion en Nintendo Switch:"
    echo " 1. Copia el archivo StreamTV.nro a la carpeta /switch/StreamTV/ en tu tarjeta SD."
    echo " 2. Inicia Atmosphere / Homebrew Launcher en tu Nintendo Switch."
    echo " 3. Ejecuta StreamTV y disfruta de tus canales, peliculas y series."
    echo "======================================================================"
else
    echo "ERROR: No se pudo encontrar StreamTV.nro despues de la compilacion."
    exit 1
fi
