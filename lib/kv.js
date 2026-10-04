const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

function ready() {
  return Boolean(url && token);
}

async function command(args) {
  if (!ready()) throw new Error('Persistent key storage is not configured');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(args)
  });
  if (!response.ok) throw new Error(`storage request failed (${response.status})`);
  const data = await response.json();
  if (data.error) throw new Error(String(data.error));
  return data.result;
}

export async function getRecord(key) {
  const value = await command(['GET', `mishraji:key:${key}`]);
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

export async function createRecord(key, record, ttlSeconds = null) {
  const args = ['SET', `mishraji:key:${key}`, JSON.stringify(record), 'NX'];
  if (Number.isFinite(ttlSeconds) && ttlSeconds > 0) args.push('EX', Math.ceil(ttlSeconds));
  const result = await command(args);
  return result === 'OK';
}

export function storageConfigured() {
  return ready();
}
