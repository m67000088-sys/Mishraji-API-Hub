import crypto from 'crypto';

function json(res, status, body) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Password');
  return res.status(status).json(body);
}

function secret() {
  return process.env.MISHRAJI_KEY_SECRET || '';
}

function adminPassword() {
  return process.env.MISHRAJI_ADMIN_PASSWORD || '';
}

function sign(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url');
}

function makeSession(expMs) {
  const payload = Buffer.from(JSON.stringify({
    iat: Date.now(),
    exp: expMs
  })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function verifySession(token) {
  if (!token || !secret()) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;
  const expected = sign(payload);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number.isFinite(data.exp) && Date.now() < data.exp;
  } catch {
    return false;
  }
}

function makeKey({ user, plan, customDate, timezoneOffset }) {
  const now = Date.now();
  let exp = null;

  if (plan === '2d') exp = now + 2 * 24 * 60 * 60 * 1000;
  else if (plan === '3d') exp = now + 3 * 24 * 60 * 60 * 1000;
  else if (plan === '7d') exp = now + 7 * 24 * 60 * 60 * 1000;
  else if (plan === '15d') exp = now + 15 * 24 * 60 * 60 * 1000;
  else if (plan === '30d') exp = now + 30 * 24 * 60 * 60 * 1000;
  else if (plan === '1y') exp = now + 365 * 24 * 60 * 60 * 1000;
  else if (plan === 'custom') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(customDate || '')) {
      throw new Error('custom expiry date required');
    }
    const [y, m, d] = customDate.split('-').map(Number);
    const offset = Number.isFinite(Number(timezoneOffset)) ? Number(timezoneOffset) : 0;
    // 23:59:59.999 in the user's selected timezone.
    exp = Date.UTC(y, m - 1, d, 23, 59, 59, 999) + offset * 60 * 1000;
    if (exp <= now) throw new Error('custom expiry date must be in the future');
  } else if (plan !== 'life') {
    throw new Error('invalid plan');
  }

  const payload = {
    v: 1,
    jti: crypto.randomBytes(12).toString('hex'),
    user: String(user || 'user').slice(0, 80),
    plan,
    iat: now,
    exp
  };

  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign(encoded);
  return {
    key: `MISHRAJI-${encoded}.${signature}`,
    expiresAt: exp,
    payload
  };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (req.method !== 'POST') return json(res, 405, { status: 'error', message: 'POST required' });
  if (!secret() || !adminPassword()) {
    return json(res, 500, { status: 'error', message: 'Server key configuration missing' });
  }

  const body = req.body || {};
  const action = body.action || 'generate';

  if (action === 'auth') {
    if (String(body.password || '') !== adminPassword()) {
      return json(res, 401, { status: 'error', message: 'Invalid admin password' });
    }
    return json(res, 200, {
      status: 'success',
      token: makeSession(Date.now() + 30 * 60 * 1000),
      expiresIn: 1800
    });
  }

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!verifySession(token)) {
    return json(res, 401, { status: 'error', message: 'Admin session expired or invalid' });
  }

  try {
    const result = makeKey({
      user: body.user,
      plan: body.plan,
      customDate: body.customDate,
      timezoneOffset: body.timezoneOffset
    });

    return json(res, 200, {
      status: 'success',
      key: result.key,
      expiresAt: result.expiresAt,
      plan: result.payload.plan,
      user: result.payload.user
    });
  } catch (err) {
    return json(res, 400, { status: 'error', message: err.message || 'Unable to generate key' });
  }
}
