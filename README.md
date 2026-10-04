# Mishra.ji API Hub

Secure short access keys for the Mishra.ji API.

## Short-key expiry design
Generated keys look like `Mishraji-A7K92P`. The key itself contains no expiry or plan information. The server stores the key record in persistent Redis/KV storage and checks the record on every API request. Expired keys cannot return API data.

## Required Vercel environment variables
- `MISHRAJI_ADMIN_PASSWORD`
- `MISHRAJI_KEY_SECRET`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are also accepted as alternate storage variable names.

Do not commit real passwords, tokens, or secrets to GitHub.

## Plans
2d, 3d, 7d, 15d, 30d, 1y, Lifetime, and Custom Date.

The client does not receive expiry metadata from `/api/number`.
