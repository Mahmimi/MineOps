import { createSocket } from 'node:dgram';
import { randomInt } from 'node:crypto';

const HANDSHAKE_PACKET_TYPE = 0x09;
const FULL_STAT_PACKET_TYPE = 0x00;
const PLAYER_SECTION_MARKER = '\u0000\u0000\u0001player_\u0000\u0000';

function parseInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseChallengeToken(response) {
  const standardValue = parseInteger(readNullTerminatedAscii(response, 5));
  if (standardValue !== null) {
    return standardValue;
  }

  const fallbackMatch = response.subarray(1).toString('ascii').match(/-?\d+/);
  return fallbackMatch ? parseInteger(fallbackMatch[0]) : null;
}

function sanitizeText(value, maxLength = 80) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/@/g, '(at)')
    .slice(0, maxLength);
}

function createPacket(packetType, sessionId, challengeToken = null) {
  const packet = challengeToken === null ? Buffer.alloc(7) : Buffer.alloc(15);
  packet[0] = 0xfe;
  packet[1] = 0xfd;
  packet[2] = packetType;
  packet.writeInt32BE(sessionId, 3);

  if (challengeToken !== null) {
    packet.writeInt32BE(challengeToken, 7);
    packet.writeInt32BE(0, 11);
  }

  return packet;
}

function readNullTerminatedAscii(buffer, offset) {
  const end = buffer.indexOf(0x00, offset);
  const finalOffset = end === -1 ? buffer.length : end;
  return buffer.subarray(offset, finalOffset).toString('ascii');
}

function parseKeyValueSection(value) {
  const entries = value.split('\u0000').filter((entry) => entry !== '');
  const result = {};

  for (let index = 0; index < entries.length - 1; index += 2) {
    const key = sanitizeText(entries[index], 64);
    const entryValue = sanitizeText(entries[index + 1], 256);
    if (key) {
      result[key] = entryValue;
    }
  }

  return result;
}

function parseFullStatResponse(response) {
  if (response.length < 5 || response[0] !== FULL_STAT_PACKET_TYPE) {
    throw new Error('Received an invalid Minecraft Query full-stat response.');
  }

  const payload = response.subarray(5).toString('latin1');
  const playerMarkerIndex = payload.indexOf(PLAYER_SECTION_MARKER);
  const infoPayload = playerMarkerIndex === -1 ? payload : payload.slice(0, playerMarkerIndex);
  const playerPayload = playerMarkerIndex === -1
    ? ''
    : payload.slice(playerMarkerIndex + PLAYER_SECTION_MARKER.length);

  const info = parseKeyValueSection(infoPayload);
  const players = playerPayload
    .split('\u0000')
    .map((player) => sanitizeText(player, 32))
    .filter((player) => player !== '');

  return {
    motd: info.hostname ?? null,
    gameType: info.gametype ?? null,
    gameId: info.game_id ?? null,
    version: info.version ?? null,
    plugins: info.plugins ?? null,
    map: info.map ?? null,
    onlineCount: parseInteger(info.numplayers),
    maxPlayers: parseInteger(info.maxplayers),
    hostPort: parseInteger(info.hostport),
    hostIp: info.hostip ?? null,
    players,
  };
}

function sendAndWait(socket, packet, host, port, expectedPacketType, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('message', onMessage);
      reject(new Error(`Minecraft Query request timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    function onMessage(message) {
      if (message[0] !== expectedPacketType) {
        return;
      }

      clearTimeout(timer);
      socket.off('message', onMessage);
      resolve(message);
    }

    socket.on('message', onMessage);
    socket.send(packet, port, host, (error) => {
      if (error) {
        clearTimeout(timer);
        socket.off('message', onMessage);
        reject(error);
      }
    });
  });
}

export class MinecraftQueryProvider {
  constructor({ config, logger }) {
    this.config = config;
    this.logger = logger;
  }

  async queryFullStatus() {
    const socket = createSocket('udp4');
    const sessionId = randomInt(1, 0x7fff);

    try {
      const handshakePacket = createPacket(HANDSHAKE_PACKET_TYPE, sessionId);
      const handshakeResponse = await sendAndWait(
        socket,
        handshakePacket,
        this.config.minecraft.queryHost,
        this.config.minecraft.queryPort,
        HANDSHAKE_PACKET_TYPE,
        this.config.minecraft.queryTimeoutMs,
      );

      const challengeToken = parseChallengeToken(handshakeResponse);
      if (challengeToken === null) {
        throw new Error('Minecraft Query challenge token was invalid.');
      }

      const fullStatPacket = createPacket(FULL_STAT_PACKET_TYPE, sessionId, challengeToken);
      const fullStatResponse = await sendAndWait(
        socket,
        fullStatPacket,
        this.config.minecraft.queryHost,
        this.config.minecraft.queryPort,
        FULL_STAT_PACKET_TYPE,
        this.config.minecraft.queryTimeoutMs,
      );

      return parseFullStatResponse(fullStatResponse);
    } finally {
      socket.close();
    }
  }

  async getPlayers() {
    try {
      const fullStatus = await this.queryFullStatus();
      return {
        available: true,
        onlineCount: fullStatus.onlineCount ?? fullStatus.players.length,
        maxPlayers: fullStatus.maxPlayers,
        players: fullStatus.players,
        source: 'minecraft-query-protocol',
        query: {
          host: this.config.minecraft.queryHost,
          port: this.config.minecraft.queryPort,
        },
        server: {
          motd: fullStatus.motd,
          version: fullStatus.version,
          map: fullStatus.map,
        },
      };
    } catch (error) {
      this.logger.warn('minecraft query provider unavailable', {
        host: this.config.minecraft.queryHost,
        port: this.config.minecraft.queryPort,
        error: error.message,
      });

      return {
        available: false,
        onlineCount: null,
        maxPlayers: null,
        players: [],
        reason: error.message,
        source: 'minecraft-query-protocol',
        query: {
          host: this.config.minecraft.queryHost,
          port: this.config.minecraft.queryPort,
        },
      };
    }
  }
}
