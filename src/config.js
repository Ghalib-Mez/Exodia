'use strict';

const LAUNCHER_VERSION = '1.0.0';

/**
 * THE ONLY URL YOU NEED TO CHANGE once your distribution is hosted.
 * See docs/DISTRIBUTION.md — works with GitHub raw or your own server.
 */
const DEFAULT_MANIFEST_URL =
  'https://raw.githubusercontent.com/YOUR-USERNAME/YOUR-REPO/main/launcher.json';

const MC_VERSION = '1.16.5';
const FORGE_VERSION = '36.2.42';
const FORGE_MINECRAFT = `${MC_VERSION}-${FORGE_VERSION}`;

const FORGE_INSTALLER_URL = `https://maven.minecraftforge.net/net/minecraftforge/forge/${FORGE_MINECRAFT}/forge-${FORGE_MINECRAFT}-installer.jar`;

// Redirects to the latest Temurin 8 JRE zip for Windows x64 (~40 MB)
const ADOPTIUM_JRE8_URL =
  'https://api.adoptium.net/v3/binary/latest/8/ga/windows/x64/jre/hotspot/normal/eclipse?project=jdk';

const INSTANCE_ID = 'tempest';

const USER_AGENT = `TempestLauncher/${LAUNCHER_VERSION} (Electron)`;

/**
 * All on-disk locations the launcher uses.
 * Everything lives under Electron's userData dir (%APPDATA%/tempest-launcher on Windows).
 */
function buildPaths(userDataPath) {
  const mcRoot = userDataPath; // MCLC root: versions/, assets/, libraries/
  const instanceDir = join(mcRoot, 'instances', INSTANCE_ID); // gameDir: mods/, saves/, servers.dat
  return {
    launcherRoot: userDataPath,
    settingsFile: join(userDataPath, 'settings.json'),
    tokenFile: join(userDataPath, 'token.json'),
    mcRoot,
    instanceDir,
    modsDir: join(instanceDir, 'mods'),
    cacheDir: join(userDataPath, 'cache'),
    javaDir: join(userDataPath, 'java'),
  };
}

function join(...parts) {
  const path = require('path');
  return path.join(...parts);
}

module.exports = {
  LAUNCHER_VERSION,
  DEFAULT_MANIFEST_URL,
  MC_VERSION,
  FORGE_VERSION,
  FORGE_MINECRAFT,
  FORGE_INSTALLER_URL,
  ADOPTIUM_JRE8_URL,
  INSTANCE_ID,
  USER_AGENT,
  buildPaths,
};
