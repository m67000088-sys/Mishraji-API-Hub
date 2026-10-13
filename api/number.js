import { getRecord } from '../lib/kv.js';

const DEVELOPER = 'Mishra.ji';
const TELEGRAM = 'https://t.me/mishra95801Ji';
const UPSTREAM_URL = 'https://num-info.noobster11001.workers.dev/';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
}

function sendError(res, status, message) {
  cors(res);
  return res.status(status).json({
    status: 'error',
    message,
    developer: DEVELOPER,
    telegram: TELEGRAM
  });
}

async function verifyKey(key) {
  if (
    typeof key !== 'string' ||
    !/^Mishraji-[A-Z0-9]{6}$/.test(key)
  ) {
    return null;
  }

  const record = await getRecord(key);

  if (!record || record.v !== 2 || !record.iat) {
    return null;
  }

  if (
    record.exp !== null &&
    record.exp !== undefined &&
    (!Number.isFinite(record.exp) || Date.now() >= record.exp)
  ) {
    return { expired: true };
  }

  return record;
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return sendError(res, 405, 'GET required');
  }

  const number = req.query.number;
  const key = req.query.key || req.query.slug || null;

  if (typeof number !== 'string' || !number.trim()) {
    return sendError(res, 400, 'number parameter required');
  }

  if (!key) {
    return sendError(res, 401, 'key required');
  }

  let payload;

  try {
    payload = await verifyKey(key);
  } catch (err) {
    console.error('Key verification failed:', err);
    return sendError(res, 503, 'key storage unavailable');
  }

  if (!payload) {
    return sendError(res, 401, 'invalid key');
  }

  if (payload.expired) {
    return sendError(res, 401, 'key expired');
  }

  try {
    const upstreamUrl = new URL(UPSTREAM_URL);
    upstreamUrl.searchParams.set('key', '@noob11001');
    upstreamUrl.searchParams.set('num', number.trim());

    const upstream = await fetch(upstreamUrl.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!upstream.ok) {
      console.error('Upstream HTTP status:', upstream.status);
      return sendError(res, 502, 'upstream service returned an error');
    }

    const responseText = await upstream.text();

    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      console.error('Upstream returned invalid JSON');
      return sendError(res, 502, 'upstream returned invalid JSON');
    }

    if (
      data === null ||
      typeof data !== 'object' ||
      Array.isArray(data)
    ) {
      return sendError(res, 502, 'unexpected upstream response format');
    }

    // Preserve all fields returned by the upstream API.
    // Do not assume every response has the same structure.
    return res.status(200).json({
      ...data,
      developer: DEVELOPER,
      telegram: TELEGRAM
    });

  } catch (err) {
    console.error('Upstream request failed:', err);

    return sendError(
      res,
      502,
      err?.name === 'TimeoutError'
        ? 'upstream request timed out'
        : 'unable to reach upstream service'
    );
  }
}
