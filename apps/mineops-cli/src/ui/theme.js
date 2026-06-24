export const icons = process.env.MINEOPS_ASCII === '1' ? {
  ok: '[OK]',
  warn: '[WARN]',
  fail: '[FAIL]',
  info: '[INFO]',
  game: 'Minecraft',
  players: 'Players',
  backup: 'Backup',
  cluster: 'Cluster',
  bot: 'Bot',
  tunnel: 'Tunnel',
  wrench: 'Maintenance',
  clock: 'Time',
  disk: 'Storage',
  spark: '*',
} : {
  ok: '\u{2705}',
  warn: '\u{26A0}\u{FE0F}',
  fail: '\u{274C}',
  info: '\u{2139}\u{FE0F}',
  game: '\u{1F3AE}',
  players: '\u{1F465}',
  backup: '\u{1F4E6}',
  cluster: '\u{2638}',
  bot: '\u{1F916}',
  tunnel: '\u{1F310}',
  wrench: '\u{1F6E0}',
  clock: '\u{23F1}',
  disk: '\u{1F4BE}',
  spark: '\u{2728}',
};

export function line() {
  return process.env.MINEOPS_ASCII === '1' ? '----------------------------------------' : '\u{2500}'.repeat(40);
}

function color(code, value) {
  return process.stdout.isTTY ? `\u001b[${code}m${value}\u001b[0m` : value;
}

export const green = (value) => color(32, value);
export const yellow = (value) => color(33, value);
export const red = (value) => color(31, value);
export const cyan = (value) => color(36, value);
