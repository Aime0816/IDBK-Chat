# Deployment and operations

## Local versus production

The README local routes run with development settings on localhost. SQLite makes the source immediately inspectable without installing MySQL. Production should use the supplied MySQL stack and a persistent private upload volume. Run one application instance. The runtime deliberately refuses production startup unless HTTPS origin, secure cookies, SMTP and antivirus host are configured.

## Production configuration

Create `.env` using `node scripts/setup.mjs`. Never commit it. Use a subdomain the school controls and a TLS reverse proxy. Example values are placeholders, not configured services:

```dotenv
NODE_ENV=production
APP_ORIGIN=https://chat.your-school-domain.example
COOKIE_SECURE=true
TRUST_PROXY=true
DB_CLIENT=mysql2
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASSWORD=your-smtp-secret
MAIL_FROM=IDBK Chat <chat@your-school-domain.example>
DEV_ALLOW_UNSCANNED=false
ALLOW_DEMO_SEED=false
```

`SMTP_SECURE=true` is for implicit TLS, commonly port 465; port 587 negotiates STARTTLS. Configure your SMTP provider's verified sender and SPF/DKIM settings. Compose sets `DB_HOST=mysql` and `CLAMAV_HOST=clamav` inside the app container. Use generated database secrets and store a recoverable copy securely.

`TRUST_PROXY=true` trusts exactly one proxy hop. Keep the Node port bound to loopback and configure a single reverse proxy to overwrite forwarding headers. Use false if running without a proxy. Never expose the database, scanner or Docker daemon publicly. Set the exact browser origin with no trailing slash.

Example Nginx server block, after provisioning valid certificates:

```nginx
server {
    listen 443 ssl;
    server_name chat.your-school-domain.example;
    ssl_certificate /etc/letsencrypt/live/chat.your-school-domain.example/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/chat.your-school-domain.example/privkey.pem;
    client_max_body_size 11m;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 75s;
    }
}
server {
    listen 80;
    server_name chat.your-school-domain.example;
    return 301 https://$host$request_uri;
}
```

Run `docker compose up --build -d`, then `docker compose exec app node dist/scripts/admin.js`. Record the bootstrap password securely and remove `ADMIN_PASSWORD` from `.env` once bootstrapped; change the password through Settings. The bootstrap command cannot overwrite an administrator. Container environment changes take effect when Compose recreates the container.

## Smoke test on the target host

1. Check `docker compose ps` and `docker compose logs app`; request `/api/health` and confirm database connectivity.
2. Create a class and a synthetic student; verify pending users cannot read conversations. Approve only after recording verification evidence.
3. Open two browsers with different approved users; exchange a message, refresh, and reconnect.
4. Send a small harmless PDF or PNG. Confirm an unrelated account cannot download it. Confirm uploads fail if the scanner is unavailable.
5. Verify actual SMTP delivery, mailbox verification, single-use recovery and password-change session revocation.
6. Publish and edit a notice, acknowledge both revisions, transfer a student and suspend an account. Verify revoked access.
7. Complete the backup/restore drill below. Remove synthetic data by using a fresh production database, not by mixing demo seed records with real students.

The included health endpoint checks the database only. Separately monitor SMTP delivery, scanner health and signature updates, disk usage, process restarts, DB errors and background worker failures. There is no metrics dashboard in the MVP. The request limiter allows 300 API requests/minute per authenticated account, with IP-based limits for unauthenticated requests and stricter auth-route limits. Review login limits for shared school networks during the pilot.

## Backup and restore

Back up the database and upload volume together, plus a separately protected copy of deployment configuration. Encrypt off-host backups, restrict access and test restores. The following Bash examples use the service's existing credentials without placing passwords in command-line arguments. Keep the app stopped during the paired snapshot to avoid file/database skew.

```sh
mkdir -p backups
chmod 700 backups
docker compose stop app
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysqldump --single-transaction --no-tablespaces -u "$MYSQL_USER" "$MYSQL_DATABASE"' > backups/database.sql
docker compose run --rm --no-deps -T app tar -C /app/data -czf - . > backups/app-data.tar.gz
docker compose start app
chmod 600 backups/database.sql backups/app-data.tar.gz
```

Check each command succeeds before proceeding and before removing any older backup. Copy successful backups to encrypted off-host storage. A SQL dump contains personal data and password hashes. Establish a retention schedule and recovery objectives with the school.

Restore into an isolated stack with an **empty destination database** and matching application version first. The following replaces destination data; do not run it against the live system accidentally:

```sh
docker compose stop app
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql -u "$MYSQL_USER" "$MYSQL_DATABASE"' < backups/database.sql
docker compose run --rm --no-deps -T app tar -C /app/data -xzf - < backups/app-data.tar.gz
docker compose up -d app
```

Verify users, historical messages, file downloads and notice acknowledgements before restoring service. MySQL schema migrations run forward; destructive down migrations are disabled. Roll back an incompatible application release only with a compatible schema or the reviewed paired backup.

## Account recovery without email

A school operator verifies identity against records through the school's established process. Run the audited command and provide the resulting link privately to the verified person:

```sh
npm run account:recovery -- student.username "Identity checked against school records by responsible staff"
```

Docker equivalent:

```sh
docker compose exec app node dist/scripts/recovery.js student.username "Identity checked against school records by responsible staff"
```

Links expire in 30 minutes, can be used once and revoke existing sessions when used. Never post them in chat groups or ordinary logs. The command requires operator access; teachers cannot arbitrarily reset accounts from their browser.

## Retention and maintenance

The worker removes expired tokens/sessions, delivered outbox entries older than seven days and unattached uploads older than 24 hours. It does not automatically delete messages, enrolments, reports, audit records, notifications or development mailbox files. Establish approved retention periods and a reviewed deletion process before real use. Development mailbox files contain sensitive tokens; delete them when no longer needed and never ship them in an archive.

Regularly update dependencies and container images, rerun build/integration/browser tests, and review reported vulnerabilities. `npm audit --omit=dev` is only an advisory check, not a security certification. Back up before upgrades. Keep the lockfile and a record of the deployed source version.
