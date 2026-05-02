#!/usr/bin/env bash
set -euo pipefail

# Build a single platform-agnostic JS bundle for GedCode.
# Outputs: dist/gedcode-VERSION.tar.gz

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VERSION="${GEDCODE_VERSION:-${GITHUB_REF_NAME:-}}"
# Strip leading v if present
VERSION="${VERSION#v}"
if [[ -z "$VERSION" ]]; then
  VERSION="$(node -e "console.log(require('$ROOT_DIR/package.json').version)")"
fi

DIST_DIR="$ROOT_DIR/dist"
STAGE_DIR="$DIST_DIR/stage/gedcode-$VERSION"

rm -rf "$DIST_DIR/stage"
mkdir -p "$DIST_DIR" "$STAGE_DIR"

echo "==> Building GedCode v$VERSION JS bundle"

# Build the plugin (TypeScript → JavaScript)
echo "  Building plugin..."
cd "$ROOT_DIR"
npm run build --workspace=@gedcode/plugin --if-present 2>/dev/null || npm run build --workspace=packages/plugin --if-present

# Copy launcher files
echo "  Copying launcher..."
mkdir -p "$STAGE_DIR/bin" "$STAGE_DIR/src"
cp "$ROOT_DIR/packages/launcher/bin/gedcode.js" "$STAGE_DIR/bin/"
cp "$ROOT_DIR/packages/launcher/src/lib.js" "$STAGE_DIR/src/"
cp "$ROOT_DIR/packages/launcher/src/release.js" "$STAGE_DIR/src/"

# Copy built plugin + resources
echo "  Copying plugin..."
mkdir -p "$STAGE_DIR/plugin"
cp "$ROOT_DIR/packages/plugin/dist/index.js" "$STAGE_DIR/plugin/"
cp -R "$ROOT_DIR/packages/plugin/src/resources" "$STAGE_DIR/plugin/resources"

# Install plugin's production dependencies into the bundle
echo "  Installing plugin dependencies..."
PLUGIN_VERSION=$(node -e "console.log(require('$ROOT_DIR/node_modules/@opencode-ai/plugin/package.json').version)")
printf '{"type":"module","dependencies":{"@opencode-ai/plugin":"%s"}}\n' "$PLUGIN_VERSION" > "$STAGE_DIR/package.json"
cd "$STAGE_DIR"
npm install --omit=dev --silent 2>&1 | tail -1

# Create the tarball
echo "  Packaging..."
cd "$DIST_DIR/stage"
tar -czf "$DIST_DIR/gedcode-${VERSION}.tar.gz" "gedcode-${VERSION}"

# Cleanup staging
rm -rf "$DIST_DIR/stage"

echo "==> Bundle ready: dist/gedcode-${VERSION}.tar.gz"
ls -lh "$DIST_DIR/gedcode-${VERSION}.tar.gz"
