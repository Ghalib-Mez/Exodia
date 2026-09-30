'use strict';

const net = require('node:net');

/**
 * Minecraft Server List Ping (status query) over vanilla TCP.
 * Sends a Handshake + Status Request and reads the JSON status response.
 * The protocol version in the handshake is ignored for status queries,
 * so this works against any modern server (including 1.16.5).
 *
 * Returns { online: true, latencyMs, players, version, motd } or
 *         { online: false, error }.
 */
async function pingServer(host, port, timeoutMs = 4000) {
  if (typeof host !== 'string' || !host.trim()) {
    return { online: false, error: 'no host' };
  }
  port = Number.parseInt(port, 10) || 25565;

  return new Promise((resolve) => {
    let buf = Buffer.alloc(0);
    let frame = null; // { value, headerSize } of the response packet
    let settled = false;
    let latencyMs = null;

    const socket = net.connect({ host, port });
    const started = Date.now();

    const done = (result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.on('timeout', () => done({ online: false, error: 'timeout' }));
    socket.on('error', (e) => done({ online: false, error: String(e.message || e) }));

    socket.on('connect', () => {
      latencyMs = Date.now() - started;
      const hostBuf = Buffer.from(host, 'utf8');
      const handshake = Buffer.concat([
        writeVarInt(0x00),                 // packet id: handshake
        writeVarInt(754),                  // protocol version (1.16.5)
        writeVarInt(hostBuf.length), hostBuf,
        (() => { const p = Buffer.alloc(2); p.writeUInt16BE(port); return p; })(),
        writeVarInt(1),                    // next state: status
      ]);
      const request = writeVarInt(0x00);   // packet id: status request
      socket.write(Buffer.concat([
        writeVarInt(handshake.length), handshake,
        writeVarInt(request.length), request,
      ]));
    });

    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      try {
        if (!frame) {
          frame = readVarInt(buf, 0);
          if (!frame) return;
          if (frame.value <= 0 || frame.value > 1 << 20) {
            return done({ online: false, error: 'bad response size' });
          }
        }
        if (buf.length < frame.headerSize + frame.value) return; // wait for full packet

        const pkt = buf.subarray(frame.headerSize, frame.headerSize + frame.value);
        const id = readVarInt(pkt, 0);       // expect 0x00 status response
        const len = readVarInt(pkt, id.headerSize);
        const off = len.headerSize + id.headerSize;
        const json = JSON.parse(pkt.subarray(off, off + len.value).toString('utf8'));

        done({
          online: true,
          latencyMs,
          players: json.players
            ? { online: json.players.online | 0, max: json.players.max | 0 }
            : null,
          version: json.version ? String(json.version.name) : null,
          motd: typeof json.description === 'string'
            ? json.description
            : (json.description && json.description.text) || '',
        });
      } catch (e) {
        done({ online: false, error: 'malformed status response' });
      }
    });
  });
}

function writeVarInt(value) {
  const bytes = [];
  let v = value >>> 0; // unsigned 32-bit
  do {
    let b = v & 0x7f;
    v >>>= 7;
    if (v !== 0) b |= 0x80;
    bytes.push(b);
  } while (v !== 0);
  return Buffer.from(bytes);
}

/** Returns { value, headerSize } or null if the buffer holds an incomplete varint. */
function readVarInt(buf, offset) {
  let value = 0;
  let shift = 0;
  let i = offset;
  while (true) {
    if (i >= buf.length) return null;
    const b = buf[i++];
    value |= (b & 0x7f) << shift;
    if (!(b & 0x80)) return { value: value | 0, headerSize: i - offset };
    if ((shift += 7) >= 35) throw new Error('varint too long');
  }
}

module.exports = { pingServer };
