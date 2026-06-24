import { icons, line } from './theme.js';

export function print(message = '') {
  process.stdout.write(`${message}\n`);
}

export function header(title) {
  print(line());
  print(` ${title}`);
  print(line());
  print('');
}

export function footer(message) {
  print('');
  print(line());
  print(message);
  print(line());
}

export function ok(label) {
  print(`${icons.ok} ${label}`);
}

export function warn(label) {
  print(`${icons.warn} ${label}`);
}

export function fail(label) {
  print(`${icons.fail} ${label}`);
}

export function usage(command) {
  if (command.description) {
    print('Description:');
    print(command.description);
    print('');
  }
  print('Usage:');
  print(command.usage);
  if (command.examples?.length) {
    print('');
    print('Examples:');
    for (const example of command.examples) print(example);
  }
}

export function card(title, rows) {
  print(line());
  print(` ${title}`);
  print(line());
  print('');
  for (const [label, value] of rows) {
    print(`${label.padEnd(14)} ${value}`);
  }
  print('');
}
