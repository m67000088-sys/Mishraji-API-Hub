import crypto from 'crypto';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function error(res, status, message) {
  cors(res);
  return res.status(status).json({
    status: 'error',
    message,
    developer: 'Mishra.ji',
    telegram: 'https://t.me/mishra95801Ji'
  });
}

function verifyKey(key) {
  const secret = process.env.MISHRAJI_KEY_SECRET || '';
  if (!secret || typeof key !== 'string' || !key.startsWith('MISHRAJI-')) return null;

  const raw = key.slice('MISHRAJI-'.length);
  const dot = raw.lastIndexOf('.');
  if (dot <= 0) return null;

  const encoded = raw.slice(0, dot);
  const supplied = raw.slice(dot + 1);
  const expected = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');

  if (supplied.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (payload.v !== 1 || !payload.jti || !payload.iat) return null;
    if (payload.exp !== null && (!Number.isFinite(payload.exp) || Date.now() >= payload.exp)) return { expired: true };
    return payload;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    cors(res);
    return res.status(204).end();
  }

  const { number } = req.query;
  const key = req.query.key || req.query.slug || null;

  if (!number) return error(res, 400, 'number parameter required');
  if (!key) return error(res, 401, 'key required');

  const payload = verifyKey(key);
  if (!payload) return error(res, 401, 'invalid key');
  if (payload.expired) return error(res, 401, 'key expired');

  try {
    const upstream = await fetch(
      `https://numberinfo-api-adibhai.vercel.app/api/number?number=${encodeURIComponent(number)}`
    );
    if (!upstream.ok) throw new Error(`upstream status ${upstream.status}`);
    const data = await upstream.json();

    cors(res);
    return res.status(200).json({
      status: data.status || 'success',
      number: data.number || number,
      data: data.data || null,
      developer: 'Mishra.ji',
      telegram: 'https://t.me/mishra95801Ji',
      key_plan: payload.plan,
      key_expires_at: payload.exp
    });
  } catch (err) {
    return error(res, 502, 'upstream fetch failed');
  }
}
