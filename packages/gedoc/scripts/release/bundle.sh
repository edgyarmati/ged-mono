#!/usr/bin/env bash
set -euo pipefail

# Build a single platform-agnostic JS bundle for GedOC.
# Outputs: dist/gedoc-VERSION.tar.gz

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VERSION="${GEDOC_VERSION:-${GITHUB_REF_NAME:-}}"
# Strip leading v if present
VERSION="${VERSION#v}"
if [[ -z "$VERSION" ]]; then
  VERSION="$(node -e "console.log(require('$ROOT_DIR/package.json').version)")"
fi

DIST_DIR="$ROOT_DIR/dist"
STAGE_DIR="$DIST_DIR/stage/gedoc-$VERSION"

rm -rf "$DIST_DIR/stage"
mkdir -p "$DIST_DIR" "$STAGE_DIR"

echo "==> Building GedOC v$VERSION JS bundle"

# Build the plugin (TypeScript → JavaScript)
echo "  Building plugin..."
cd "$ROOT_DIR"
npm run build --workspace=@gedoc/plugin --if-present 2>/dev/null || npm run build --workspace=packages/plugin --if-present

# Copy launcher files
echo "  Copying launcher..."
mkdir -p "$STAGE_DIR/bin" "$STAGE_DIR/src"
cp "$ROOT_DIR/packages/launcher/bin/gedoc.js" "$STAGE_DIR/bin/"
cp "$ROOT_DIR/packages/launcher/src/lib.js" "$STAGE_DIR/src/"
cp "$ROOT_DIR/packages/launcher/src/release.js" "$STAGE_DIR/src/"

# Copy built plugin + resources
echo "  Copying plugin..."
mkdir -p "$STAGE_DIR/plugin"
cp "$ROOT_DIR/packages/plugin/dist/index.js" "$STAGE_DIR/plugin/"
cp -R "$ROOT_DIR/packages/plugin/src/resources" "$STAGE_DIR/plugin/resources"

# Install plugin's production dependencies into the bundle
echo "  Installing plugin dependencies..."
cd "$ROOT_DIR"
PLUGIN_VERSION=$(node -e "const fs=require('node:fs'); const path=require('node:path'); const candidates=[path.join(process.cwd(),'node_modules/@opencode-ai/plugin/package.json'), path.join(process.cwd(),'../../node_modules/@opencode-ai/plugin/package.json')]; const pkgPath=candidates.find((p)=>fs.existsSync(p)); if(!pkgPath) throw new Error('Could not locate @opencode-ai/plugin/package.json'); console.log(JSON.parse(fs.readFileSync(pkgPath,'utf8')).version)")
printf '{"type":"module","dependencies":{"@opencode-ai/plugin":"%s"}}\n' "$PLUGIN_VERSION" > "$STAGE_DIR/package.json"
cd "$STAGE_DIR"
npm install --omit=dev --silent 2>&1 | tail -1

# Bundle the local shared checkpoint package used by the compiled plugin.
mkdir -p "$STAGE_DIR/node_modules/@ged/shared-checkpoints"
cp "$ROOT_DIR/../shared/src/index.js" "$STAGE_DIR/node_modules/@ged/shared-checkpoints/index.js"
cp "$ROOT_DIR/../shared/src/index.d.ts" "$STAGE_DIR/node_modules/@ged/shared-checkpoints/index.d.ts"
printf '{"name":"@ged/shared-checkpoints","type":"module","exports":{".":{"types":"./index.d.ts","default":"./index.js"}}}\n' > "$STAGE_DIR/node_modules/@ged/shared-checkpoints/package.json"

# Create the tarball
echo "  Packaging..."
cd "$DIST_DIR/stage"
tar -czf "$DIST_DIR/gedoc-${VERSION}.tar.gz" "gedoc-${VERSION}"

# Cleanup staging
rm -rf "$DIST_DIR/stage"

echo "==> Bundle ready: dist/gedoc-${VERSION}.tar.gz"
ls -lh "$DIST_DIR/gedoc-${VERSION}.tar.gz"
