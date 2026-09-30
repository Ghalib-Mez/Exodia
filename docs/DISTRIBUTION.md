# Distribution Guide — `launcher.json`

The launcher is driven by **one JSON manifest** that you host. It describes your server, the
modpack, and every mod file. The launcher downloads exactly what the manifest says, verifies
each file against its SHA-1, and keeps the player's `mods/` folder in sync automatically.

The schema uses **absolute URLs only**, so the same `launcher.json` works unchanged whether you
host it on **GitHub** or **your own server**.

---

## 1. Schema reference

```jsonc
{
  "schemaVersion": 1,                    // must be 1

  "launcher": {                          // optional — launcher cosmetics
    "minLauncherVersion": "1.0.0",       // optional — reserved for future upgrades
    "newsUrl": "https://…",              // optional — news page (https)
    "background": "https://…/bg.jpg",    // optional — custom background image (https)
    "heroImage": "https://…/keyart.jpg"  // optional — keyart behind the PLAY button (https)
  },

  "news": [                              // optional — cards on the main screen (max ~8 useful)
    {
      "title": "Season 1 launches Friday!", // required
      "body": "The storm arrives…",         // required, short text
      "date": "2026-10-02",              // optional
      "url": "https://…",                // optional — card opens this link when clicked
      "image": "https://…/card.jpg"      // optional — card background image
    }
  ],

  "server": {                            // required
    "name": "Tempest Factions",          // shown in the UI + pinned in the multiplayer list
    "address": "play.example.com",       // server IP/domain (no port here)
    "port": 25565,                       // optional — omit or use 25565 for default
    "discord": "https://discord.gg/…",   // optional — shows a Discord button
    "website": "https://…"               // optional
  },

  "modpack": {                           // required
    "id": "tempest-factions",            // internal id (a-z, 0-9, dashes)
    "displayName": "Tempest Factions",   // shown in the launcher
    "version": "1.0.0",                  // bump this to force players to re-sync mods
    "minecraft": "1.16.5",               // must match the launcher's supported version
    "forge": "36.2.42",                  // Forge build for 1.16.5
    "memory": { "min": "2G", "max": "4G" } // optional — default RAM (player can override)
  },

  "mods": [                              // optional — list of mod jars
    {
      "id": "plugin-name",               // any unique id
      "name": "Human-readable Name",     // shown in the progress bar
      "file": "pluginname-1.0.jar",      // file name in the mods/ folder (must end .jar, unique)
      "url": "https://…/pluginname-1.0.jar", // direct download URL (https)
      "sha1": "da39a3ee5e6b4b0d3255bfef95601890afd80709", // SHA-1 of the jar (40 hex chars)
      "size": 123456,                    // exact size in bytes
      "required": true                   // false = skip silently if the download fails
    }
  ],

  "files": []                            // reserved for future use (config overrides)
}
```

### Field rules

| Field | Required | Notes |
|---|---|---|
| `schemaVersion` | yes | `1` |
| `server.name`, `server.address` | yes | strings |
| `modpack.minecraft`, `modpack.forge`, `modpack.version` | yes | strings |
| `mods[].url` | yes | **https only** (plain `http://localhost` allowed for testing) |
| `mods[].sha1` | yes | 40 hex chars — launcher refuses mismatches |
| `mods[].size` | yes | exact bytes — protects against truncated downloads |
| `mods[].file` | yes | unique, ends with `.jar` |
| everything else | no | safe to omit |

All URLs are **absolute**. The launcher fetches mod files directly from wherever they live —
GitHub, your CDN, or your game server — nothing is relative to the manifest location.

---

## 2. How to hash your mods

Run the bundled helper from the launcher project folder:

```bash
npm run hash path/to/mod.jar     # one file
npm run hash path/to/mods-folder # every .jar in a folder
```

It prints `"file"`, `"sha1"` and `"size"` for each jar — paste them into `mods[]`.

(Windows one-liner alternative: `certutil -hashfile mod.jar SHA1`)

---

## 3. Hosting option A — GitHub (free, recommended to start)

### Repo layout

```
your-repo/
├── launcher.json
└── mods/
    ├── pluginname-1.0.jar
    └── anothermod-2.3.jar
```

### Steps

1. Create a GitHub repo (public — raw URLs need no auth; private repos require tokens).
2. Put `launcher.json` at the repo root and your mod jars under `mods/`.
3. In every mod entry, use raw URLs:

   ```
   https://raw.githubusercontent.com/<USER>/<REPO>/main/mods/pluginname-1.0.jar
   ```

4. Your manifest URL is:

   ```
   https://raw.githubusercontent.com/<USER>/<REPO>/main/launcher.json
   ```

5. Put that URL either in `src/config.js` (`DEFAULT_MANIFEST_URL`) before building the
   launcher, or leave the default and let players paste it in Settings — or both.

**Files up to 100 MB** work via raw URLs. For bigger jars use a GitHub
[Release](https://github.com/<USER>/<REPO>/releases) instead — the asset URL
(`https://github.com/<USER>/<REPO>/releases/download/v1.0/file.jar`) is also a valid
direct-download URL for the manifest.

### Updating the pack

1. Add/replace jars in `mods/`, run `npm run hash` on them, update `mods[]`.
2. Bump `modpack.version` (e.g. `1.0.1`).
3. Commit + push. Every player's next launch syncs automatically.

---

## 4. Hosting option B — your own server

Any static web server works (nginx, Apache, Cloudflare Pages, a VPS…).

### Layout

```
/var/www/launcher/
├── launcher.json
└── mods/
    └── *.jar
```

- Manifest URL: `https://yourdomain.com/launcher.json`
- Mod URLs: `https://yourdomain.com/mods/pluginname-1.0.jar` (or point them at any other host)

Requirements:
- Serve over **HTTPS** (the launcher rejects plain http except `http://localhost` for testing).
- Correct `Content-Type` for jars is not required; the launcher only checks SHA-1 + size.
- No CORS configuration needed — downloads happen in the main process, not the browser.

### Same JSON, different host

Because URLs are absolute, you can literally copy the same `launcher.json` between GitHub and
your server, or host mods on a CDN while the manifest lives on GitHub. To switch the launcher
to a new manifest URL, change `DEFAULT_MANIFEST_URL` in `src/config.js` (built into the app) —
the Settings panel override always wins.

---

## 5. Full worked example (GitHub)

```json
{
  "schemaVersion": 1,
  "launcher": {
    "newsUrl": "https://tempestfactions.com/news"
  },
  "server": {
    "name": "Tempest Factions",
    "address": "play.tempestfactions.com",
    "port": 25565,
    "discord": "https://discord.gg/tempest",
    "website": "https://tempestfactions.com"
  },
  "modpack": {
    "id": "tempest-factions",
    "displayName": "Tempest Factions",
    "version": "1.0.0",
    "minecraft": "1.16.5",
    "forge": "36.2.42",
    "memory": { "min": "2G", "max": "4G" }
  },
  "mods": [
    {
      "id": "natural-disasters",
      "name": "Natural Disasters",
      "file": "naturaldisasters-1.2.jar",
      "url": "https://raw.githubusercontent.com/tempest/distro/main/mods/naturaldisasters-1.2.jar",
      "sha1": "5f1b5f2d9e3a4c6788bb0f1d2e3a4c6788bb0f1d",
      "size": 1048576,
      "required": true
    }
  ]
}
```

A ready-to-fill template lives in [`example/launcher.json`](../example/launcher.json).

---

## 6. What the launcher does with it

On every PLAY click:

1. Fetches `launcher.json` and validates the schema.
2. Restores/refreshes the player's Microsoft session.
3. Ensures **Java 8** (uses system Java 8 if present, else auto-downloads Temurin JRE).
4. Ensures the **Forge installer** (SHA-1 verified against Maven).
5. **Delta-syncs mods**: downloads new/changed jars, deletes removed ones, verifies every
   SHA-1 — a bad or tampered file never lands in `mods/`.
6. Writes `servers.dat` so your server is pinned at the top of the multiplayer list.
7. Launches Forge 1.16.5 via minecraft-launcher-core with the player's Microsoft token.

 Players never touch any of this — they click PLAY.
