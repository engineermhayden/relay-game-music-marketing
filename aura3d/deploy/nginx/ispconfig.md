# ISPConfig gateway → Dockerized nginx

```text
Browser ──HTTPS──▶ ISPConfig nginx (TLS, Let's Encrypt) ──HTTP──▶ 127.0.0.1:8080 (aura-relay nginx) ──▶ api / static SPA
```

ISPConfig terminates TLS and forwards everything to the Compose `nginx` service, which already routes `/api/`, `/ws/` and the SPA. The gateway's job is to preserve the public `Host`, report the original scheme in `X-Forwarded-Proto`, and pass WebSocket upgrades through on `/ws/`.

Replace `your-domain.com` and the upstream `127.0.0.1:8080` below with your values. If ISPConfig runs on a different machine from Docker, use the Docker host's private IP instead of `127.0.0.1`.

## 1. Website settings

**Sites → Websites → *your site***

| Tab | Setting | Value |
| --- | --- | --- |
| Domain | Domain | `your-domain.com` |
| Domain | Auto-Subdomain | `None` (or `www.`, see [www](#www-subdomain)) |
| Domain | SSL / Let's Encrypt SSL | ✔ / ✔ |
| Domain | PHP | `Disabled` (otherwise ISPConfig's `\.php$` location intercepts requests) |
| Redirect | Rewrite HTTP to HTTPS | ✔ |

## 2. nginx Directives

Paste this into **Options → nginx Directives** and save:

```nginx
# SPA, static assets and /api/
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    # Overwrite rather than append: the API trusts this header for client IPs and throttling.
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection "";
    proxy_read_timeout 60s;
}

# Live room connections (/ws/rooms/<code>/)
location /ws/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
    proxy_send_timeout 120s;
    proxy_buffering off;
}
```

Why these values:

- `Host $host`: Django validates it against `ALLOWED_HOSTS`, and the inner nginx forwards it unchanged.
- `X-Forwarded-Proto $scheme`: Django uses it (`SECURE_PROXY_SSL_HEADER`) to treat requests as HTTPS for secure cookies and CSRF origin checks. With "Rewrite HTTP to HTTPS" on, it is always `https` by the time a request is proxied.
- `/ws/` needs its own block because WebSocket upgrades require HTTP/1.1 plus `Upgrade`/`Connection` headers. The inner nginx closes idle sockets at 90s; the gateway timeout is set above that so it is never the limit (the client heartbeats at 10 Hz anyway).
- `proxy_read_timeout 60s` sits above the inner nginx's 40s `/api/` timeout and the frontend's 35s request timeout, so slow AI replies are cut by the app, not the gateway.
- ISPConfig's own `^~ /.well-known/acme-challenge/` location still takes precedence over `location /`, so Let's Encrypt renewals keep working.

## 3. Matching app `.env`

```dotenv
ALLOWED_HOSTS=your-domain.com,localhost,127.0.0.1
CSRF_TRUSTED_ORIGINS=https://your-domain.com,http://localhost:8080,http://127.0.0.1:8080
COOKIE_SECURE=true
# Same host as ISPConfig: publish only on loopback so the plain-HTTP origin isn't reachable from outside.
HTTP_PORT=127.0.0.1:8080
```

Compose publishes `${HTTP_PORT}:80`, so `HTTP_PORT=127.0.0.1:8080` becomes `127.0.0.1:8080:80`. Without it, Docker binds `0.0.0.0:8080` and bypasses host firewalls such as ufw, which exposes an origin that trusts forwarded headers. If ISPConfig is on another machine, keep `HTTP_PORT=8080` and restrict port 8080 to the gateway's IP at the network/provider firewall.

After changing `.env`: `docker compose up -d`.

### www subdomain

If the site also answers on `www.`, add `www.your-domain.com` to `ALLOWED_HOSTS` and `https://www.your-domain.com` to `CSRF_TRUSTED_ORIGINS`, or use ISPConfig's SEO Redirect to send `www` to the bare domain.

## 4. Verify

```sh
curl -sI https://your-domain.com/            # 200, served by the SPA
curl -s  https://your-domain.com/api/health/ # health JSON from the API
curl -sI http://your-domain.com/             # 301 to https://
```

Then open the site, join a room, and check DevTools → Network → WS: the `/ws/rooms/<code>/` request should show `101 Switching Protocols` and stay open.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `400 Bad Request` on every page | Domain missing from `ALLOWED_HOSTS`, or `Host` not forwarded |
| `403` CSRF failure on joining/creating a room | Origin missing from `CSRF_TRUSTED_ORIGINS`, or `X-Forwarded-Proto` not reaching the app |
| Session lost on every reload | `COOKIE_SECURE=true` while the site is reached over plain HTTP |
| Room never goes live / WS errors | `/ws/` block missing or the `Upgrade`/`Connection` headers dropped |
| `502 Bad Gateway` | Compose stack down, or the upstream address/port doesn't match `HTTP_PORT` |
| ISPConfig rejects the directives with `duplicate location "/"` | The vhost template already defines `location /`; put `##merge##` as the first line inside the `location /` block |
