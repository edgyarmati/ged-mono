export const GEDOC_REPOSITORY = "edgyarmati/ged-mono";
export const GEDOC_RELEASE_CHANNEL = "latest";
export const GEDOC_BINARY_VERSION = "0.4.0";
export const OPENCODE_VERSION_TARGET = "1.14.30";

export function normalizePlatform(platform) {
  return platform;
}

export function normalizeArch(arch) {
  return arch;
}

export function getLauncherAssetExtension(platform) {
  return "tar.gz";
}

export function getLauncherAssetName(platform, arch, version = GEDOC_BINARY_VERSION) {
  return `gedoc-${version}.${getLauncherAssetExtension(platform)}`;
}

export function getLatestReleaseAssetUrl(platform, arch) {
  return `https://github.com/${GEDOC_REPOSITORY}/releases/latest/download/${getLauncherAssetName(platform, arch)}`;
}

export function getVersionedReleaseAssetUrl(platform, arch, version) {
  return `https://github.com/${GEDOC_REPOSITORY}/releases/download/gedoc-v${version}/${getLauncherAssetName(platform, arch, version)}`;
}

export function getRequiredOpenCodeVersion() {
  return OPENCODE_VERSION_TARGET;
}
