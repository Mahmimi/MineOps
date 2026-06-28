export function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;

  for (const nested of Object.values(value)) {
    deepFreeze(nested);
  }

  return Object.freeze(value);
}

