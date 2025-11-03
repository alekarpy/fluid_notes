#!/usr/bin/env bash
set -euo pipefail

# === Ajusta si tu ruta cambia ===
PROJECT_DIR="/Users/kamedina/WebstormProjects/notas-fluido"

# Detect Opera / Opera GX
OPERA_APP=""
if [ -x "/Applications/Opera.app/Contents/MacOS/Opera" ]; then
  OPERA_APP="/Applications/Opera.app/Contents/MacOS/Opera"
elif [ -x "/Applications/Opera GX.app/Contents/MacOS/Opera GX" ]; then
  OPERA_APP="/Applications/Opera GX.app/Contents/MacOS/Opera GX"
else
  echo "❌ No encuentro Opera. Ajusta la ruta al binario."
  exit 1
fi

MANIFEST="$PROJECT_DIR/manifest.json"
[ -f "$MANIFEST" ] || { echo "❌ No existe manifest.json en $PROJECT_DIR"; exit 1; }

# Leer versión del manifest
VERSION="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$MANIFEST" | head -n1)"
[ -n "$VERSION" ] || { echo "❌ No pude leer la versión de manifest.json"; exit 1; }
echo "🔖 Versión: $VERSION"

DIST="$PROJECT_DIR/dist"
mkdir -p "$DIST"

# ------- Gestión de clave .pem (para mantener el mismo ID) -------
CANDIDATE_OUTSIDE="${PROJECT_DIR%/}.pem"          # /Users/.../notas-fluido.pem
CANDIDATE_INSIDE="$PROJECT_DIR/notas-fluido.pem"  # /Users/.../notas-fluido/notas-fluido.pem

# Si está ADENTRO, muévela AFUERA (Opera no permite empaquetarla dentro)
if [ -f "$CANDIDATE_INSIDE" ]; then
  echo "⚠️  La clave está dentro del proyecto; moviéndola fuera para evitar que se empaquete…"
  mv -f "$CANDIDATE_INSIDE" "$CANDIDATE_OUTSIDE"
  chmod 600 "$CANDIDATE_OUTSIDE" || true
fi

KEY_PATH=""
if [ -f "$CANDIDATE_OUTSIDE" ]; then
  # Canoniza ruta absoluta
  KEY_PATH="$(cd "$(dirname "$CANDIDATE_OUTSIDE")" && pwd)/$(basename "$CANDIDATE_OUTSIDE")"
  if [ ! -r "$KEY_PATH" ]; then
    echo "❌ La clave existe pero no es legible: $KEY_PATH"; exit 1
  fi
  echo "🔐 Usando clave: $KEY_PATH"
else
  echo "ℹ️ Sin clave .pem; Opera generará una nueva (nuevo ID la primera vez)."
fi

# ------- Cerrar Opera y limpiar artefactos previos -------
osascript -e 'tell application "Opera" to quit' >/dev/null 2>&1 || true
osascript -e 'tell application "Opera GX" to quit' >/dev/null 2>&1 || true
pkill -f "/Applications/Opera.app/Contents/MacOS/Opera"     >/dev/null 2>&1 || true
pkill -f "/Applications/Opera GX.app/Contents/MacOS/Opera"  >/dev/null 2>&1 || true
sleep 1

# NO borres la clave fuera del proyecto; solo limpia el .crx previo.
rm -f "${PROJECT_DIR%/}.crx" 2>/dev/null || true
# Solo borra la .pem junto a la carpeta si NO estás usando una clave existente (caso de generación nueva)
if [ -z "${KEY_PATH:-}" ]; then
  rm -f "${PROJECT_DIR%/}.pem" 2>/dev/null || true
fi

# ------- Empaquetar (CRX) con perfil temporal -------
echo "📦 Empaquetando extensión (CRX)…"
TMP_PROFILE="$(mktemp -d -t opera-pack-XXXX)"
CMD=( "$OPERA_APP" --user-data-dir="$TMP_PROFILE" --pack-extension="$PROJECT_DIR" )
[ -n "${KEY_PATH:-}" ] && CMD+=( --pack-extension-key="$KEY_PATH" )
"${CMD[@]}" || true

# Opera deja .crx/.pem junto a la carpeta del proyecto
SRC_CRX="${PROJECT_DIR%/}.crx"
SRC_PEM="${PROJECT_DIR%/}.pem"

# Esperar hasta 6s a que aparezca el .crx
for i in {1..12}; do
  [ -f "$SRC_CRX" ] && break
  sleep 0.5
done

OUT_CRX="$DIST/notas-fluido-$VERSION.crx"
if [ -f "$SRC_CRX" ]; then
  mv -f "$SRC_CRX" "$OUT_CRX"
  echo "✅ CRX: $OUT_CRX"
else
  echo "❌ Opera no generó ${SRC_CRX}."
  echo "   Prueba manual:"
  echo "   \"$OPERA_APP\" --user-data-dir=\"$TMP_PROFILE\" --pack-extension=\"$PROJECT_DIR\""
  rm -rf "$TMP_PROFILE" || true
  exit 1
fi

# Si Opera generó una nueva clave, guárdala FUERA del proyecto
if [ -z "${KEY_PATH:-}" ] && [ -f "$SRC_PEM" ]; then
  mv -f "$SRC_PEM" "$CANDIDATE_OUTSIDE"
  chmod 600 "$CANDIDATE_OUTSIDE" || true
  echo "🔑 Clave generada: $CANDIDATE_OUTSIDE (guárdala para mantener el mismo ID)"
fi

# ------- ZIP para la tienda (no incluyas .pem/.crx, ni dist) -------
echo "🗜️  Creando ZIP para la tienda…"
OUT_ZIP="$DIST/notas-fluido-$VERSION.zip"
(
  cd "$PROJECT_DIR"
  zip -r -X -9 "$OUT_ZIP" . \
    -x "dist/*" "*.pem" "*.crx" \
       ".DS_Store" "__MACOSX/*" \
       ".git/*" ".idea/*" ".vscode/*" \
       "node_modules/*" "tests/*" \
       "pack-opera.sh" \
       "README*" "screenshot*"
)
echo "✅ ZIP: $OUT_ZIP"

# Limpieza del perfil temporal
rm -rf "$TMP_PROFILE" || true
echo "🎉 Listo. CRX y ZIP generados."