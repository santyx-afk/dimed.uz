/** Muhit o'zgaruvchilari. Yo'q bo'lsa — darhol tushunarli xato. */
export function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Muhit o'zgaruvchisi sozlanmagan: ${name}`);
  return value;
}

export const optional = (name: string, fallback = ''): string => process.env[name] ?? fallback;

export const AWS_REGION = optional('DIMED_AWS_REGION', 'eu-central-1');
export const TABLE_PREFIX = optional('DIMED_TABLE_PREFIX', 'dimed');

export const tableName = (name: string): string => `${TABLE_PREFIX}_${name}`;
