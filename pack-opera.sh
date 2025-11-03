#!/usr/bin/env bash
set -euo pipefail

# === AUTO-DETECTA EL DIRECTORIO ACTUAL ===
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
NAME="fluid_notes"

echo "📂 Proyecto: $PROJECT_DIR"

MANIFEST="$PROJECT_DIR/manifest.json"
[ -f "$MANIFEST" ] || { echo "❌ No existe manifest.json en $PROJECT_DIR"; exit 1; }

# --- AUTO-INCREMENTAR VERSIÓN ---
CURRENT_VERSION=$(grep -oE '"version": *"[^"]+"' "$MANIFEST" | cut -d'"' -f4)
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
PATCH=$((PATCH + 1))
NEW_VERSION="$MAJOR.$MINOR.$PATCH"

# Reemplazar en el manifest
sed -i.bak -E "s/\"version\": *\"[0-9]+\.[0-9]+\.[0-9]+\"/\"version\": \"$NEW_VERSION\"/" "$MANIFEST"
rm -f "$MANIFEST.bak"

echo "🔖 Versión actualizada: $CURRENT_VERSION → $NEW_VERSION"

# --- Detectar Opera / Opera GX ---
OPERA_APP=""
if [ -x "/Applications/Opera.app/Contents/MacOS/Opera" ]; then
  OPERA_APP="/Applications/Opera.app/Contents/MacOS/Opera"
elif [ -x "/Applications/Opera GX.app/Contents/MacOS/Opera GX" ]; then
  OPERA_APP="/Applications/Opera GX.app/Contents/MacOS/Opera GX"
else
  echo "❌ No encuentro Opera. Ajusta la ruta al binario."
  exit 1
fi

DIST="$PROJECT_DIR/dist"
mkdir -p "$DIST"

# --- Gestión de clave .pem ---
CANDIDATE_OUTSIDE="$PROJECT_DIR/$NAME.pem"
CANDIDATE_INSIDE="$PROJECT_DIR/$NAME.pem"

KEY_PATH=""
if [ -f "$CANDIDATE_OUTSIDE" ]; then
  KEY_PATH="$CANDIDATE_OUTSIDE"
  echo "🔐 Usando clave existente: $KEY_PATH"
else
  echo "ℹ️ Sin clave .pem; Opera generará una nueva."
fi

# --- Cerrar Opera si está abierta ---
osascript -e 'tell application "Opera" to quit' >/dev/null 2>&1 || true
osascript -e 'tell application "Opera GX" to quit' >/dev/null 2>&1 || true
sleep 1

# --- Empaquetar CRX ---
echo "📦 Empaquetando extensión (CRX)…"
TMP_PROFILE="$(mktemp -d -t opera-pack-XXXX)"
CMD=( "$OPERA_APP" --user-data-dir="$TMP_PROFILE" --pack-extension="$PROJECT_DIR" )
[ -n "${KEY_PATH:-}" ] && CMD+=( --pack-extension-key="$KEY_PATH" )
"${CMD[@]}" || true

SRC_CRX="${PROJECT_DIR%/}.crx"
OUT_CRX="$DIST/${NAME}-${NEW_VERSION}.crx"
[ -f "$SRC_CRX" ] && mv -f "$SRC_CRX" "$OUT_CRX" && echo "✅ CRX: $OUT_CRX"

# --- Crear ZIP para la tienda ---
echo "🗜️  Creando ZIP para la tienda…"
STAGE="$DIST/.store-stage"
OUT_ZIP="$DIST/${NAME}-${NEW_VERSION}.zip"
rm -rf "$STAGE" "$OUT_ZIP"
mkdir -p "$STAGE/assets"

cp "$PROJECT_DIR/manifest.json" "$STAGE/"
cp "$PROJECT_DIR/popup.html" "$STAGE/" || true
cp "$PROJECT_DIR/popup.css" "$STAGE/" || true
cp "$PROJECT_DIR/popup.js" "$STAGE/" || true
cp "$PROJECT_DIR/service_worker.js" "$STAGE/" || true

for f in icon-16.png icon-32.png icon-48.png icon-128.png; do
  [ -f "$PROJECT_DIR/assets/$f" ] && cp "$PROJECT_DIR/assets/$f" "$STAGE/assets/"
done

(
  cd "$STAGE"
  zip -r -X -9 "../$(basename "$OUT_ZIP")" .
)

rm -rf "$STAGE" "$TMP_PROFILE"
echo "✅ ZIP: $OUT_ZIP"
echo "🎉 Listo. Versión $NEW_VERSION empaquetada correctamente."
