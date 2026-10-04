import { getRecord } from '../lib/kv.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function error(res, status, message) {
  cors(res);
  return res.status(status).json({ status: 'error', message, developer: 'Mishra.ji', telegram: 'https://t.me/mishra95801Ji' });
}

async function verifyKey(key) {
  if (typeof key !== 'string' || !/^Mishraji-[A-Z0-9]{6}$/.test(key)) return null;
  const record = await getRecord(key);
  if (!record || record.v !== 2 || !record.iat) return null;
  if (record.exp !== null && (!Number.isFinite(record.exp) || Date.now() >= record.exp)) return { expired: true };
  return record;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); return res.status(204).end(); }
  if (req.method !== 'GET') return error(res, 405, 'GET required');

  const { number } = req.query;
  const key = req.query.key || req.query.slug || null;
  if (!number) return error(res, 400, 'number parameter required');
  if (!key) return error(res, 401, 'key required');

  let payload;
  try { payload = await verifyKey(key); }
  catch { return error(res, 503, 'key storage unavailable'); }
  if (!payload) return error(res, 401, 'invalid key');
  if (payload.expired) return error(res, 401, 'key expired');

  try {
    const upstream = await fetch(`https://numberinfo-api-adibhai.vercel.app/api/number?number=${encodeURIComponent(number)}`);
    if (!upstream.ok) throw new Error(`upstream status ${upstream.status}`);
    const data = await upstream.json();
    cors(res);
    return res.status(200).json({
      status: data.status || 'success',
      number: data.number || number,
      data: data.data || null,
      developer: 'Mishra.ji',
      telegram: 'https://t.me/mishra95801Ji'
    });
  } catch {
    return error(res, 502, 'upstream fetch failed');
  }
}
