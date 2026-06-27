export function isValidNamespaceName(value) {
  return /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(value) && value.length <= 63;
}

export function isValidCronExpression(value) {
  const fields = value.trim().split(/\s+/);
  if (fields.length !== 5) return false;

  return fields.every((field) => /^(\*|\d{1,2}|\d{1,2}-\d{1,2}|\*\/\d{1,2}|\d{1,2}(,\d{1,2})*)$/.test(field));
}

export function isValidCpuQuantity(value) {
  return /^([1-9]\d*m|([1-9]\d*|0?\.\d+|[1-9]\d*\.\d+))$/.test(String(value));
}

export function isValidMemoryQuantity(value) {
  return /^[1-9]\d*([KMGTP]i?|[kmg])?$/.test(String(value));
}

