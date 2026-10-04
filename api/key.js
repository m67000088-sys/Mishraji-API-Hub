import crypto from 'crypto';
import { createRecord, storageConfigured } from '../lib/kv.js';

function json(res, status, body) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Password');
  return res.status(status).json(body);
}

function secret() { return process.env.MISHRAJI_KEY_SECRET || ''; }
function adminPassword() { return process.env.MISHRAJI_ADMIN_PASSWORD || ''; }
function sign(value) { return crypto.createHmac('sha256', secret()).update(value).digest('base64url'); }

function makeSession(expMs) {
  const payload = Buffer.from(JSON.stringify({ iat: Date.now(), exp: expMs })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function verifySession(token) {
  if (!token || !secret()) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;
  const expected = sign(payload);
  if (signature.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number.isFinite(data.exp) && Date.now() < data.exp;
  } catch { return false; }
}

function expiryFor(plan, customDate, timezoneOffset) {
  const now = Date.now();
  if (plan === '2d') return now + 2 * 86400000;
  if (plan === '3d') return now + 3 * 86400000;
  if (plan === '7d') return now + 7 * 86400000;
  if (plan === '15d') return now + 15 * 86400000;
  if (plan === '30d') return now + 30 * 86400000;
  if (plan === '1y') return now + 365 * 86400000;
  if (plan === 'life') return null;
  if (plan === 'custom') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(customDate || '')) throw new Error('custom expiry date required');
    const [y, m, d] = customDate.split('-').map(Number);
    const offset = Number.isFinite(Number(timezoneOffset)) ? Number(timezoneOffset) : 0;
    const exp = Date.UTC(y, m - 1, d, 23, 59, 59, 999) + offset * 60000;
    if (exp <= now) throw new Error('custom expiry date must be in the future');
    return exp;
  }
  throw new Error('invalid plan');
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randomCode(length = 6) {
  let out = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

async function makeShortKey(record) {
  for (let i = 0; i < 12; i++) {
    const key = `Mishraji-${randomCode(6)}`;
    const ttl = record.exp === null ? null : Math.max(1, Math.ceil((record.exp - Date.now()) / 1000));
    if (await createRecord(key, record, ttl)) return key;
  }
  throw new Error('unable to create a unique key');
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (req.method !== 'POST') return json(res, 405, { status: 'error', message: 'POST required' });
  if (!secret() || !adminPassword() || !storageConfigured()) {
    return json(res, 500, { status: 'error', message: 'Server key configuration missing' });
  }

  const body = req.body || {};
  if (body.action === 'auth') {
    if (String(body.password || '') !== adminPassword()) return json(res, 401, { status: 'error', message: 'Invalid admin password' });
    return json(res, 200, { status: 'success', token: makeSession(Date.now() + 30 * 60 * 1000), expiresIn: 1800 });
  }

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!verifySession(token)) return json(res, 401, { status: 'error', message: 'Admin session expired or invalid' });

  try {
    const plan = body.plan;
    const exp = expiryFor(plan, body.customDate, body.timezoneOffset);
    const record = {
      v: 2,
      user: String(body.user || 'user').slice(0, 80),
      plan,
      iat: Date.now(),
      exp
    };
    const key = await makeShortKey(record);
    return json(res, 200, { status: 'success', key });
  } catch (err) {
    return json(res, 400, { status: 'error', message: err.message || 'Unable to generate key' });
  }
}
