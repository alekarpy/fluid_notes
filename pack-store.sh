#!/bin/bash
# ============================================
# Empaqueta extensión "Notas Fluido" para la tienda de Opera
# Genera un ZIP limpio sin archivos de desarrollo
# ============================================

# Ruta base del proyecto
ROOT_DIR="/Users/kamedina/WebstormProjects/notas-fluido"
DIST_DIR="$ROOT_DIR/dist"

# Crear carpeta dist si no existe
mkdir -p "$DIST_DIR"

# Leer versión desde manifest.json (requiere jq)
if command -v jq &>/dev/null; then
  VERSION=$(jq -r '.version' "$ROOT_DIR/manifest.json")
else
  VERSION="manual"
fi

# Nombre del archivo resultante
ZIP_NAME="notas-fluido-store-${VERSION}.zip"
ZIP_PATH="$DIST_DIR/$ZIP_NAME"

echo "📦 Empaquetando extensión para Opera Store..."
echo "➡️  Archivo de salida: $ZIP_PATH"

# Empaquetar excluyendo archivos no permitidos
cd "$ROOT_DIR" || exit
zip -r -X -9 "$ZIP_PATH" . \
  -x "dist/*" \
     "*.pem" \
     "*.crx" \
     "*.sh" \
     ".DS_Store" \
     "__MACOSX/*" \
     ".idea/*" \
     ".git/*" \
     ".gitignore" \
     "node_modules/*" \
     "package*.json"

if [ $? -eq 0 ]; then
  echo "✅ ZIP generado correctamente en:"
  echo "   $ZIP_PATH"
else
  echo "❌ Error al crear el ZIP."
fi
