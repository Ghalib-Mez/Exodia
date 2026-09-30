'use strict';

const fs = require('fs');
const { Auth, tokenUtils } = require('msmc');

/**
 * Microsoft account authentication via msmc.
 * Login opens the system browser ("raw" mode) — no Electron remote module needed.
 * Tokens are persisted to disk and restored/refreshed on subsequent launches.
 */
class AuthManager {
  constructor(tokenFile) {
    this.tokenFile = tokenFile;
    this.auth = new Auth('select_account');
    this.mcToken = null; // msmc Minecraft token object
  }

  /** Open the system browser for Microsoft sign-in. Resolves with the player profile. */
  async login() {
    const xbox = await this.auth.launch('raw');
    this.mcToken = await xbox.getMinecraft();
    this._persist();
    return this.profile();
  }

  /**
   * Restore a saved session (refreshing it against Microsoft if needed).
   * Resolves with the profile, or null if there is no saved session.
   */
  async restore() {
    if (this.mcToken) return this.profile();
    if (!fs.existsSync(this.tokenFile)) return null;
    let saved;
    try {
      saved = JSON.parse(fs.readFileSync(this.tokenFile, 'utf8'));
    } catch {
      return null;
    }
    try {
      // refresh=true → validates and refreshes the token round-trip via Microsoft
      this.mcToken = await tokenUtils.fromToken(this.auth, saved, true);
    } catch {
      // Refresh token expired/revoked → user must log in again
      this.logout();
      return null;
    }
    this._persist();
    return this.profile();
  }

  /** MCLC-shaped authorization object for minecraft-launcher-core. */
  mclcAuthorization() {
    if (!this.mcToken) throw new Error('Not logged in');
    return this.mcToken.mclc();
  }

  profile() {
    if (!this.mcToken) return null;
    const p = this.mcToken.profile || {};
    return { name: p.name, id: p.id, demo: !!p.demo };
  }

  logout() {
    this.mcToken = null;
    fs.rmSync(this.tokenFile, { force: true });
  }

  _persist() {
    fs.writeFileSync(this.tokenFile, JSON.stringify(this.mcToken.getToken(), null, 2), 'utf8');
  }
}

module.exports = { AuthManager };
