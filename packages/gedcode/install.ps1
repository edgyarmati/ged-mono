# GedCode installer for Windows.
# Requires: PowerShell 5.1+, Node.js >= 22
#
# Usage:
#   irm https://github.com/edgyarmati/gedcode/releases/latest/download/install.ps1 | iex
#   # or pin a version:
#   $env:GEDCODE_VERSION = '0.3.0'; irm ... | iex

$ErrorActionPreference = 'Stop'

$RepoSlug = 'edgyarmati/gedcode'
$Version = if ($env:GEDCODE_VERSION) { $env:GEDCODE_VERSION } else { '0.3.0' }
$DataDir = if ($env:GEDCODE_DATA_DIR) {
  $env:GEDCODE_DATA_DIR
} elseif ($env:LOCALAPPDATA) {
  Join-Path $env:LOCALAPPDATA 'GedCode'
} else {
  Join-Path $HOME '.local\share\gedcode'
}
$BinDir = if ($env:GEDCODE_BIN_DIR) {
  $env:GEDCODE_BIN_DIR
} elseif ($env:LOCALAPPDATA) {
  Join-Path $env:LOCALAPPDATA 'GedCode\bin'
} else {
  Join-Path $HOME '.local\bin'
}
$MinimumNodeMajor = 22

# ── Check Node.js ────────────────────────────────────────────────────────────

$nodeExe = $null
try {
  $nodeExe = (Get-Command node -ErrorAction Stop).Source
}
catch {
  Write-Error @"

Node.js $MinimumNodeMajor+ is required but not found.

Install Node.js:
  - Download from https://nodejs.org
  - Or: winget install OpenJS.NodeJS.LTS

Then rerun this installer.
"@
  exit 1
}

$nodeVersion = (node -v) -replace '^v', ''
$nodeMajor = $nodeVersion.Split('.')[0]
if ([int]$nodeMajor -lt $MinimumNodeMajor) {
  Write-Error "Node.js $MinimumNodeMajor+ is required, but found v$nodeVersion. Please upgrade."
  exit 1
}

# ── Download and extract ─────────────────────────────────────────────────────

New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
New-Item -ItemType Directory -Force -Path $BinDir | Out-Null

$TempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("gedcode-install-" + [System.Guid]::NewGuid())
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null

try {
  $AssetName = "gedcode-$Version.tar.gz"
  $AssetUrl = "https://github.com/$RepoSlug/releases/download/v$Version/$AssetName"
  $SumsUrl = "https://github.com/$RepoSlug/releases/download/v$Version/SHA256SUMS"
  $ArchivePath = Join-Path $TempDir $AssetName
  $SumsPath = Join-Path $TempDir 'SHA256SUMS'

  Write-Host "==> Downloading GedCode v$Version"
  try {
    Invoke-WebRequest -Uri $AssetUrl -OutFile $ArchivePath
  }
  catch {
    Write-Error "Download failed. Check that v$Version exists at $AssetUrl"
    exit 1
  }

  Write-Host '==> Verifying SHA256 checksum'
  try {
    Invoke-WebRequest -Uri $SumsUrl -OutFile $SumsPath
  }
  catch {
    Write-Error "Could not fetch SHA256SUMS for v$Version. Refusing to install an unverified archive."
    exit 1
  }

  $expectedHash = $null
  foreach ($line in Get-Content -Path $SumsPath) {
    $parts = ($line -replace '\s+', ' ').Trim().Split(' ', 2)
    if ($parts.Length -ne 2) { continue }
    $name = $parts[1].TrimStart('*')
    if ($name -eq $AssetName) {
      $expectedHash = $parts[0].ToLowerInvariant()
      break
    }
  }
  if (-not $expectedHash) {
    Write-Error "SHA256SUMS does not contain an entry for $AssetName."
    exit 1
  }

  $actualHash = (Get-FileHash -Path $ArchivePath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($expectedHash -ne $actualHash) {
    Write-Error "Checksum mismatch for $AssetName. Expected $expectedHash, got $actualHash."
    exit 1
  }
  Write-Host '    Checksum OK'

  Write-Host "==> Extracting to $DataDir"
  tar -xzf $ArchivePath -C $TempDir

  $SrcDir = Join-Path $TempDir "gedcode-$Version"
  if (-not (Test-Path $SrcDir)) {
    Write-Error "Unexpected archive layout - expected gedcode-$Version/ inside tarball"
    exit 1
  }

  # Remove previous lib, replace with new
  $LibDir = Join-Path $DataDir 'lib'
  if (Test-Path $LibDir) {
    Remove-Item -Recurse -Force $LibDir
  }
  Copy-Item -Recurse -Force $SrcDir $LibDir
  Write-Host "    Installed to $LibDir"

  # ── Create wrapper scripts ──────────────────────────────────────────────────

  # .cmd wrapper
  $CmdWrapper = Join-Path $BinDir 'gedcode.cmd'
  $EntryJs = Join-Path $LibDir 'bin\gedcode.js'
  @"
@echo off
node "$EntryJs" %*
"@ | Set-Content -Path $CmdWrapper -Encoding ASCII
  Write-Host "    Created launcher at $CmdWrapper"

  # PowerShell wrapper (so `gedcode` also works in PowerShell)
  $Ps1Wrapper = Join-Path $BinDir 'gedcode.ps1'
  @"
node "$EntryJs" @args
"@ | Set-Content -Path $Ps1Wrapper -Encoding ASCII

  # ── Verify ──────────────────────────────────────────────────────────────────

  $checkOutput = & node $EntryJs --check 2>`$null
  if ($LASTEXITCODE -ne 0) {
    Write-Error 'Launcher script has syntax errors. Something went wrong with the install.'
    exit 1
  }

  Write-Host ''
  Write-Host "==> GedCode v$Version installed successfully"
  Write-Host ''

  # ── Install mode: launcher (recommended) or plugin ────────────────────────

  $InstallMode = $env:GEDCODE_INSTALL_MODE
  if (-not $InstallMode) {
    Write-Host 'GedCode can be set up in two ways:'
    Write-Host ''
    Write-Host '  1) Launcher (recommended) -- "gedcode" becomes a separate command.'
    Write-Host '     Your normal "opencode" setup is left untouched. GedCode runs in its'
    Write-Host '     own isolated config with its own managed OpenCode runtime.'
    Write-Host ''
    Write-Host '  2) Plugin -- GedCode is added to your existing OpenCode config.'
    Write-Host '     Every "opencode" session gets the Omni workflow automatically, but'
    Write-Host '     there is no isolation from your normal OpenCode setup.'
    Write-Host ''
    $modeAnswer = Read-Host 'Choose install mode [1/2] (default: 1)'
    if ($modeAnswer -eq '2') {
      $InstallMode = 'plugin'
    } else {
      $InstallMode = 'launcher'
    }
  }

  if ($InstallMode -eq 'plugin') {
    $PluginPath = Join-Path $LibDir 'packages\plugin\dist\index.js'
    if (-not (Test-Path $PluginPath)) {
      $PluginPath = Join-Path $LibDir 'plugin\index.js'
    }
    Write-Host ''
    Write-Host '==> Plugin mode selected'
    Write-Host "    Plugin path: $PluginPath"
    Write-Host ''
    Write-Host 'Add the following to your OpenCode config (usually %APPDATA%\opencode\opencode.json):'
    Write-Host ''
    Write-Host '  {'
    Write-Host '    "default_agent": "gedcode",'
    Write-Host "    `"plugin`": [`"file:///$($PluginPath -replace '\\','/')`"]
    Write-Host '  }'
    Write-Host ''
    Write-Host 'Then just run: opencode'
  }

  Write-Host ''

  # ── Optional: mention RTK ──────────────────────────────────────────────────

  $rtkCmd = Get-Command rtk -ErrorAction SilentlyContinue
  if ($rtkCmd) {
    Write-Host "==> RTK is already installed ($($rtkCmd.Source))"
  } else {
    Write-Host '==> RTK (optional CLI output compression for 60-90% token savings) is not installed.'
    Write-Host '    GedCode works fine without it. If RTK becomes available for Windows,'
    Write-Host '    install it for automatic bash output compression.'
  }

  Write-Host ''
  Write-Host 'Next step:'
  if ($InstallMode -eq 'plugin') {
    Write-Host '  Update your OpenCode config as shown above, then run: opencode'
  } else {
    Write-Host '  gedcode'
  }
  Write-Host ''
  if ($InstallMode -ne 'plugin') {
    $gedcodeCmd = Get-Command gedcode -ErrorAction SilentlyContinue
    if (-not $gedcodeCmd) {
      Write-Host "Add $BinDir to your PATH if not already there."
      Write-Host "  `$env:PATH = `"$BinDir;`$(`$env:PATH)`""
    }
  }
}
finally {
  if (Test-Path $TempDir) {
    Remove-Item -Recurse -Force $TempDir
  }
}
