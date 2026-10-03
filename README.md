# Mishra.ji API Hub

## Vercel environment variables

Set these two variables in Vercel before using the key generator:

- `MISHRAJI_ADMIN_PASSWORD` = your admin password (the requested default is `Mishra.ji`)
- `MISHRAJI_KEY_SECRET` = a long random secret, different from the admin password

Do not put the real secret in GitHub.

## Key expiry

Keys are signed on the server with HMAC-SHA256. The API verifies the signature and expiry on every request. Editing the HTML cannot extend a key.

Available plans: 2d, 3d, 7d, 15d, 30d, 1y, Lifetime, and Custom Date.
