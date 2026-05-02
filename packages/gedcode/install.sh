#!/usr/bin/env bash
# GedCode installer — works on macOS and Linux.
# Requires: curl, tar, Node.js >= 22
#
# Usage:
#   curl -fsSL https://github.com/edgyarmati/gedcode/releases/latest/download/install.sh | bash
#   # or pin a version:
#   GEDCODE_VERSION=0.3.0 curl -fsSL ... | bash
set -euo pipefail

REPO_SLUG="edgyarmati/gedcode"
VERSION="${GEDCODE_VERSION:-0.3.0}"
DATA_DIR="${GEDCODE_DATA_DIR:-$HOME/.local/share/gedcode}"
BIN_DIR="${GEDCODE_BIN_DIR:-$HOME/.local/bin}"
MINIMUM_NODE_MAJOR=22

info()  { printf '==> %s\n' "$1"; }
warn()  { printf 'Warning: %s\n' "$1" >&2; }
fail()  { printf 'Error: %s\n' "$1" >&2; exit 1; }

# ── Detect platform ──────────────────────────────────────────────────────────

platform_os() {
  case "$(uname -s)" in
    Darwin) printf 'darwin' ;;
    Linux)  printf 'linux' ;;
    *)      fail "Unsupported OS: $(uname -s)" ;;
  esac
}

# ── Check prerequisites ──────────────────────────────────────────────────────

if ! command -v curl >/dev/null 2>&1; then
  fail "curl is required. Install it and rerun."
fi
if ! command -v tar >/dev/null 2>&1; then
  fail "tar is required. Install it and rerun."
fi

# ── Check Node.js ────────────────────────────────────────────────────────────

if ! command -v node >/dev/null 2>&1; then
  cat >&2 <<EOF
Error: Node.js ${MINIMUM_NODE_MAJOR}+ is required but not found.

Install Node.js:
  macOS:  brew install node
  Linux:  curl -fsSL https://fnm/install.sh | bash && fnm install --lts
  Or visit: https://nodejs.org

Then rerun this installer.
EOF
  exit 1
fi

NODE_MAJOR=$(node -e "console.log(process.version.replace(/^v/, '').split('.')[0])" 2>/dev/null || echo "0")
if [ "$NODE_MAJOR" -lt "$MINIMUM_NODE_MAJOR" ]; then
  fail "Node.js ${MINIMUM_NODE_MAJOR}+ is required, but found $(node -v). Please upgrade."
fi

# ── Download and extract ─────────────────────────────────────────────────────

mkdir -p "$DATA_DIR" "$BIN_DIR"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

ASSET_NAME="gedcode-${VERSION}.tar.gz"
ASSET_URL="https://github.com/${REPO_SLUG}/releases/download/v${VERSION}/${ASSET_NAME}"
SUMS_URL="https://github.com/${REPO_SLUG}/releases/download/v${VERSION}/SHA256SUMS"
ARCHIVE="$TMP_DIR/${ASSET_NAME}"
SUMS_FILE="$TMP_DIR/SHA256SUMS"

info "Downloading GedCode v${VERSION}"
curl -fsSL "$ASSET_URL" -o "$ARCHIVE" || fail "Download failed. Check that v${VERSION} exists at ${ASSET_URL}"

info "Verifying SHA256 checksum"
curl -fsSL "$SUMS_URL" -o "$SUMS_FILE" \
  || fail "Could not fetch SHA256SUMS for v${VERSION}. Refusing to install an unverified archive."

# Locate a sha256 verifier
if command -v sha256sum >/dev/null 2>&1; then
  SHA_CMD="sha256sum"
elif command -v shasum >/dev/null 2>&1; then
  SHA_CMD="shasum -a 256"
else
  fail "Need sha256sum or shasum to verify the download. Install one and rerun."
fi

EXPECTED_HASH="$(awk -v name="${ASSET_NAME}" '$2 == name || $2 == "*"name {print $1; exit}' "$SUMS_FILE")"
if [ -z "$EXPECTED_HASH" ]; then
  fail "SHA256SUMS does not contain an entry for ${ASSET_NAME}."
fi

ACTUAL_HASH="$(${SHA_CMD} "$ARCHIVE" | awk '{print $1}')"
if [ "$EXPECTED_HASH" != "$ACTUAL_HASH" ]; then
  fail "Checksum mismatch for ${ASSET_NAME}. Expected ${EXPECTED_HASH}, got ${ACTUAL_HASH}."
fi
info "Checksum OK"

info "Extracting to ${DATA_DIR}"
tar -xzf "$ARCHIVE" -C "$TMP_DIR"

# The tarball contains gedcode-VERSION/...
SRC_DIR="$TMP_DIR/gedcode-${VERSION}"
if [ ! -d "$SRC_DIR" ]; then
  fail "Unexpected archive layout — expected gedcode-${VERSION}/ directory inside tarball"
fi

# Remove previous install, replace with new
rm -rf "${DATA_DIR}/lib"
cp -R "$SRC_DIR" "${DATA_DIR}/lib"
info "Installed to ${DATA_DIR}/lib"

# ── Create shell wrapper ─────────────────────────────────────────────────────

WRAPPER="${BIN_DIR}/gedcode"
cat > "$WRAPPER" <<WRAPPER_EOF
#!/usr/bin/env bash
exec node "${DATA_DIR}/lib/bin/gedcode.js" "\$@"
WRAPPER_EOF
chmod +x "$WRAPPER"

info "Created launcher at ${WRAPPER}"

# ── Verify ───────────────────────────────────────────────────────────────────

if ! node "${DATA_DIR}/lib/bin/gedcode.js" --check >/dev/null 2>&1; then
  # Fall back to syntax-only validation if the launcher check path changes.
  if ! node --check "${DATA_DIR}/lib/bin/gedcode.js" 2>/dev/null; then
    fail "Launcher script has syntax errors. Something went wrong with the install."
  fi
fi

info "GedCode v${VERSION} installed successfully"
printf '\n'

# ── Install mode: launcher (recommended) or plugin ──────────────────────────

INSTALL_MODE="${GEDCODE_INSTALL_MODE:-}"

if [ -z "$INSTALL_MODE" ]; then
  cat <<'MODE_EOF'
GedCode can be set up in two ways:

  1) Launcher (recommended) — "gedcode" becomes a separate command.
     Your normal "opencode" setup is left untouched. GedCode runs in its
     own isolated config with its own managed OpenCode runtime.

  2) Plugin — GedCode is added to your existing OpenCode config.
     Every "opencode" session gets the Omni workflow automatically, but
     there is no isolation from your normal OpenCode setup.

MODE_EOF
  printf 'Choose install mode [1/2] (default: 1): '
  read -r _mode_answer </dev/tty 2>/dev/null || _mode_answer="1"
  case "$_mode_answer" in
    2*) INSTALL_MODE="plugin" ;;
    *)  INSTALL_MODE="launcher" ;;
  esac
fi

case "$INSTALL_MODE" in
  plugin)
    PLUGIN_PATH="${DATA_DIR}/lib/packages/plugin/dist/index.js"
    if [ ! -f "$PLUGIN_PATH" ]; then
      # Release bundles may have a different layout
      PLUGIN_PATH="${DATA_DIR}/lib/plugin/index.js"
    fi
    printf '\n'
    info "Plugin mode selected"
    info "Plugin path: ${PLUGIN_PATH}"
    printf '\n'
    printf 'Add the following to your OpenCode config (usually ~/.config/opencode/opencode.json):\n\n'
    printf '  {\n'
    printf '    "default_agent": "gedcode",\n'
    printf '    "plugin": ["file://%s"]\n' "$PLUGIN_PATH"
    printf '  }\n\n'
    printf 'Then just run: opencode\n'
    ;;
  launcher|*)
    # Launcher mode is already set up above — wrapper was created.
    ;;
esac

printf '\n'

# ── Optional: offer RTK ──────────────────────────────────────────────────────

if command -v rtk >/dev/null 2>&1; then
  info "RTK is already installed ($(rtk --version 2>/dev/null || echo 'unknown version'))"
elif command -v brew >/dev/null 2>&1; then
  printf 'GedCode can optionally use RTK, a CLI proxy that compresses bash output\n'
  printf '(git, ls, test runners, etc.) for 60-90%% token savings. It is not required.\n'
  printf '\n'
  if [ -z "${GEDCODE_SKIP_RTK:-}" ]; then
    printf 'Install RTK via Homebrew? [Y/n] '
    read -r _rtk_answer </dev/tty 2>/dev/null || _rtk_answer="n"
    case "$_rtk_answer" in
      n*|N*) info "Skipping RTK. Install later with: brew install rtk" ;;
      *)
        info "Installing RTK via Homebrew"
        if brew install rtk 2>/dev/null; then
          info "RTK installed successfully"
        else
          warn "RTK installation failed. GedCode will work without it. Install later with: brew install rtk"
        fi
        ;;
    esac
  else
    info "Skipping RTK (GEDCODE_SKIP_RTK is set). Install later with: brew install rtk"
  fi
else
  info "RTK (optional CLI output compression for 60-90% token savings) is available via Homebrew."
  info "Install Homebrew (brew.sh) and then: brew install rtk"
fi

printf '\n'
printf 'Next step:\n'
if [ "$INSTALL_MODE" = "plugin" ]; then
  printf '  Update your OpenCode config as shown above, then run: opencode\n\n'
else
  printf '  gedcode\n\n'
fi
if [ "$INSTALL_MODE" != "plugin" ] && ! command -v gedcode >/dev/null 2>&1; then
  printf 'Add %s to your PATH if not already there.\n' "$BIN_DIR"
  printf '  export PATH="%s:\$PATH"\n' "$BIN_DIR"
fi
