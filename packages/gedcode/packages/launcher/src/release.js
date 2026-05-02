export const GEDCODE_REPOSITORY = "edgyarmati/gedcode";
export const GEDCODE_RELEASE_CHANNEL = "latest";
export const GEDCODE_BINARY_VERSION = "0.3.0";
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

export function getLauncherAssetName(platform, arch, version = GEDCODE_BINARY_VERSION) {
  return `gedcode-${version}.${getLauncherAssetExtension(platform)}`;
}

export function getLatestReleaseAssetUrl(platform, arch) {
  return `https://github.com/${GEDCODE_REPOSITORY}/releases/latest/download/${getLauncherAssetName(platform, arch)}`;
}

export function getVersionedReleaseAssetUrl(platform, arch, version) {
  return `https://github.com/${GEDCODE_REPOSITORY}/releases/download/v${version}/${getLauncherAssetName(platform, arch, version)}`;
}

export function getRequiredOpenCodeVersion() {
  return OPENCODE_VERSION_TARGET;
}
