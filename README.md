# Tempest Launcher

Custom Electron launcher for the **Tempest Factions** Minecraft server — Forge 1.16.5,
Microsoft account login, automatic Java/Forge/mod installation.

## Quick start (development)

```bash
npm install
npm start
```

## Before releasing to players — 3 things to configure

1. **Host your `launcher.json`** — fill in [`example/launcher.json`](example/launcher.json)
   (server IP, Discord link, your mod list), put it in a GitHub repo (or your own server)
   next to your mod jars, and follow **[docs/DISTRIBUTION.md](docs/DISTRIBUTION.md)** —
   it contains the full JSON schema and step-by-step hosting guides.
2. **Point the launcher at it** — set `DEFAULT_MANIFEST_URL` in [`src/config.js`](src/config.js)
   to your manifest URL. (Players can also paste a URL in Settings; that override wins.)
3. **Your mods** — drop your `.jar` files in the repo, then run:

   ```bash
   npm run hash path/to/your/mods-folder
   ```

   Paste the printed `"sha1"` / `"size"` values into the `mods[]` entries of `launcher.json`.

## What PLAY does

Manifest → Microsoft session refresh → Java 8 (auto-downloads Temurin if missing) →
Forge 1.16.5 (SHA-1 verified from Maven) → mod delta-sync (per-file SHA-1) → pins the server
in the multiplayer list → launches the game with the player's token.

Players never see any of that — one click.

## Building an installer

```bash
npm run dist     # NSIS installer + portable .exe into dist/
```

## Project layout

```
main.js / preload.js    Electron entry, IPC bridge (sandboxed renderer)
src/config.js           ← the one file to edit when your distribution goes live
src/auth.js             Microsoft login via msmc (system-browser flow, token refresh)
src/manifest.js         fetch + strict validation of launcher.json
src/java.js             Java 8 detection / Adoptium download
src/forge.js            Forge installer cache (Maven SHA-1 verified)
src/mods.js             mods/ delta-sync (download changed, delete removed)
src/serversDat.js       writes servers.dat so your server is pinned in-game
src/launch.js           pipeline orchestration + MCLC launch
renderer/               storm-themed UI (login, progress, settings)
example/launcher.json   fill-in template for your distribution
docs/DISTRIBUTION.md    SCHEMA + GitHub / own-server hosting guides
scripts/hash.js         npm run hash — compute sha1/size for your mod jars
```
