/**
 * Testlar uchun xotiradagi soxta DynamoDB.
 *
 * Haqiqiy AWS'siz API funksiyalarini uchdan-uchgacha sinash imkonini
 * beradi. Faqat loyihada ishlatiladigan amallar qo'llab-quvvatlanadi:
 * PutItem, GetItem, DeleteItem, UpdateItem, Query, Scan va oddiy
 * ConditionExpression'lar.
 */
import { createServer } from 'node:http';

const tables = new Map(); // jadval -> Map(kalit -> item)
const keySchema = {
  test_users: ['telegram_id'],
  test_otp_codes: ['phone'],
  test_individuals: ['phone', 'sort_key'],
  test_doctors: ['doctor_id'],
  test_schedules: ['doctor_id', 'date'],
  test_appointments: ['doctor_day', 'time'],
  test_payments: ['payment_id'],
  test_lab_results: ['phone', 'sort_key'],
};
for (const t of Object.keys(keySchema)) tables.set(t, new Map());

const un = (v) => {
  if (v === null || typeof v !== 'object') return v;
  if ('S' in v) return v.S;
  if ('N' in v) return Number(v.N);
  if ('BOOL' in v) return v.BOOL;
  if ('NULL' in v) return null;
  if ('L' in v) return v.L.map(un);
  if ('M' in v) return Object.fromEntries(Object.entries(v.M).map(([k, x]) => [k, un(x)]));
  return v;
};
const marshal = (v) => {
  if (v === null || v === undefined) return { NULL: true };
  if (typeof v === 'string') return { S: v };
  if (typeof v === 'number') return { N: String(v) };
  if (typeof v === 'boolean') return { BOOL: v };
  if (Array.isArray(v)) return { L: v.map(marshal) };
  return { M: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, marshal(x)])) };
};
const itemKey = (table, item) => keySchema[table].map((k) => String(item[k])).join('|');

/** DynamoDB ifodalarini juda sodda tarzda hisoblaydi (testlar uchun yetarli). */
function evalCondition(expr, item, names, values) {
  if (!expr) return true;
  const resolve = (token) => {
    if (token.startsWith(':')) return values[token];
    const name = token.startsWith('#') ? names[token] : token;
    return item ? item[name] : undefined;
  };
  // Faqat butun bandni o'rab turgan qavslar olib tashlanadi —
  // attribute_not_exists(...) ichidagilari emas.
  const unwrap = (clause) => {
    const t = clause.trim();
    return t.startsWith('(') && t.endsWith(')') ? t.slice(1, -1) : t;
  };

  return expr
    .split(' OR ')
    .some((clause) =>
      unwrap(clause)
        .split(' AND ')
        .every((part) => {
          const t = part.trim();
          let m = t.match(/^attribute_not_exists\((\w+)\)$/);
          if (m) return !item || item[m[1]] === undefined;
          m = t.match(/^attribute_exists\((\w+)\)$/);
          if (m) return Boolean(item && item[m[1]] !== undefined);
          m = t.match(/^([#\w]+)\s*(=|<|>|<=|>=)\s*(:\w+)$/);
          if (m) {
            const left = resolve(m[1]);
            const right = resolve(m[3]);
            if (left === undefined) return false;
            switch (m[2]) {
              case '=': return left === right;
              case '<': return left < right;
              case '>': return left > right;
              case '<=': return left <= right;
              default: return left >= right;
            }
          }
          throw new Error(`Soxta DynamoDB bu shartni bilmaydi: ${t}`);
        }),
    );
}

function applyUpdate(item, expr, names, values) {
  const next = { ...item };
  const setPart = expr.match(/SET (.+?)(?: REMOVE |$)/s)?.[1];
  const removePart = expr.match(/REMOVE (.+)$/s)?.[1];

  if (setPart) {
    for (const assign of setPart.split(',')) {
      const [rawKey, rawVal] = assign.split('=').map((s) => s.trim());
      if (!rawKey || !rawVal) continue;
      const key = rawKey.startsWith('#') ? names[rawKey] : rawKey;
      next[key] = values[rawVal];
    }
  }
  if (removePart) {
    for (const raw of removePart.split(',')) {
      const key = raw.trim();
      delete next[key.startsWith('#') ? names[key] : key];
    }
  }
  return next;
}

const server = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const target = (req.headers['x-amz-target'] ?? '').split('.').pop();
    const payload = JSON.parse(body || '{}');
    const table = payload.TableName;
    const store = tables.get(table);
    const send = (obj, code = 200) => {
      res.writeHead(code, { 'content-type': 'application/x-amz-json-1.0' });
      res.end(JSON.stringify(obj));
    };
    const fail = (type) =>
      send({ __type: `com.amazonaws.dynamodb.v20120810#${type}`, message: type }, 400);

    const names = payload.ExpressionAttributeNames ?? {};
    const values = Object.fromEntries(
      Object.entries(payload.ExpressionAttributeValues ?? {}).map(([k, v]) => [k, un(v)]),
    );

    if (target === 'PutItem') {
      const item = Object.fromEntries(Object.entries(payload.Item).map(([k, v]) => [k, un(v)]));
      const existing = store.get(itemKey(table, item));
      if (!evalCondition(payload.ConditionExpression, existing, names, values)) {
        return fail('ConditionalCheckFailedException');
      }
      store.set(itemKey(table, item), item);
      return send({});
    }

    if (target === 'GetItem') {
      const key = Object.fromEntries(Object.entries(payload.Key).map(([k, v]) => [k, un(v)]));
      const item = store.get(itemKey(table, key));
      return send(item ? { Item: Object.fromEntries(Object.entries(item).map(([k, v]) => [k, marshal(v)])) } : {});
    }

    if (target === 'DeleteItem') {
      const key = Object.fromEntries(Object.entries(payload.Key).map(([k, v]) => [k, un(v)]));
      store.delete(itemKey(table, key));
      return send({});
    }

    if (target === 'UpdateItem') {
      const key = Object.fromEntries(Object.entries(payload.Key).map(([k, v]) => [k, un(v)]));
      const id = itemKey(table, key);
      const existing = store.get(id);
      if (!evalCondition(payload.ConditionExpression, existing, names, values)) {
        return fail('ConditionalCheckFailedException');
      }
      store.set(id, applyUpdate(existing ?? key, payload.UpdateExpression, names, values));
      return send({});
    }

    if (target === 'Scan') {
      const items = [...store.values()];
      return send({
        Items: items.map((i) => Object.fromEntries(Object.entries(i).map(([k, v]) => [k, marshal(v)]))),
      });
    }

    if (target === 'Query') {
      const cond = payload.KeyConditionExpression;
      const m = cond.match(/([#\w]+)\s*=\s*(:\w+)/);
      const field = m[1].startsWith('#') ? names[m[1]] : m[1];
      const wanted = values[m[2]];
      const items = [...store.values()].filter((i) => i[field] === wanted);
      return send({
        Items: items.map((i) => Object.fromEntries(Object.entries(i).map(([k, v]) => [k, marshal(v)]))),
      });
    }

    return send({ message: `Qo'llab-quvvatlanmaydi: ${target}` }, 400);
  });
});

/** Serverni ishga tushiradi va endpoint manzilini qaytaradi. */
export async function startFakeDynamo() {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

export const stopFakeDynamo = () => server.close();

/** Jadvalga tayyor yozuv qo'shadi. */
export const seed = (table, key, item) => tables.get(table).set(key, item);

export const tableOf = (table) => tables.get(table);
