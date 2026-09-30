'use strict';

const fs = require('fs');
const path = require('path');
const nbt = require('prismarine-nbt');

/**
 * Write servers.dat into the instance dir so the server appears
 * at the top of the multiplayer list (1.16.5 has no --server launch arg).
 */
function writeServersDat(instanceDir, server) {
  const ip = !server.port || server.port === 25565 ? server.address : `${server.address}:${server.port}`;

  const tag = {
    type: 'compound',
    name: '',
    value: {
      servers: {
        type: 'list',
        value: {
          type: 'compound',
          value: [
            {
              name: { type: 'string', value: server.name || 'Server' },
              ip: { type: 'string', value: ip },
              hidden: { type: 'byte', value: 0 },
            },
          ],
        },
      },
    },
  };

  fs.mkdirSync(instanceDir, { recursive: true });
  fs.writeFileSync(path.join(instanceDir, 'servers.dat'), nbt.writeUncompressed(tag, 'big'));
}

module.exports = { writeServersDat };
