//! Docker Compose files and unified SERVICES.md for self-hosted integrations.
//!
//! `service_compose_stubs()` — per-service `docker-compose.yml` + `.env.example` files;
//!   returned as static `(path, content)` pairs for inclusion in `feature_config_stubs()`.
//!
//! `build_services_doc()` — builds a single `SERVICES.md` covering all selected services.

use crate::features::{
    AllFeatures, ChatChoice, CmsChoice, CommerceChoice, CommunityChoice, CourseChoice,
    CrmChoice, EmailChoice, EventChoice, FormsChoice, ForumChoice, KnowledgeBaseChoice,
    NotifyChoice, PaymentChoice, PodcastChoice, ScheduleChoice, SearchChoice,
    SsoChoice, StatusChoice, TransactionalEmailChoice, VideoChoice,
};

// ── Listmonk ──────────────────────────────────────────────────────────────────

pub(crate) const COMPOSE_LISTMONK: &str = concat!(
    "# Listmonk + Caddy reverse proxy + Postgres.\n",
    "# Caddy strips X-Frame-Options so Listmonk can be embedded in the Astropress admin panel.\n",
    "#\n",
    "# Usage:\n",
    "#   cp .env.listmonk.example .env.listmonk\n",
    "#   # Edit .env.listmonk and set DB_PASSWORD and SITE_URL\n",
    "#   docker compose --env-file .env.listmonk up -d\n",
    "#\n",
    "# Deploy to Railway: connect this directory as a Docker Compose service.\n",
    "# Deploy to Fly.io:  cd listmonk && fly launch && fly deploy\n",
    "services:\n",
    "  caddy:\n",
    "    image: caddy:2-alpine\n",
    "    ports:\n",
    "      - \"80:80\"\n",
    "      - \"443:443\"\n",
    "    volumes:\n",
    "      - ./Caddyfile:/etc/caddy/Caddyfile\n",
    "      - caddy_data:/data\n",
    "    environment:\n",
    "      SITE_URL: \"${SITE_URL:-https://example.com}\"\n",
    "    depends_on:\n",
    "      - listmonk\n",
    "    restart: unless-stopped\n",
    "\n",
    "  listmonk:\n",
    "    image: listmonk/listmonk:latest\n",
    "    environment:\n",
    "      LISTMONK_app__address: \"0.0.0.0:9000\"\n",
    "      LISTMONK_db__host: db\n",
    "      LISTMONK_db__port: \"5432\"\n",
    "      LISTMONK_db__user: listmonk\n",
    "      LISTMONK_db__password: \"${DB_PASSWORD:?set DB_PASSWORD in .env.listmonk}\"\n",
    "      LISTMONK_db__database: listmonk\n",
    "    depends_on:\n",
    "      db:\n",
    "        condition: service_healthy\n",
    "    restart: unless-stopped\n",
    "\n",
    "  db:\n",
    "    image: postgres:16-alpine\n",
    "    environment:\n",
    "      POSTGRES_USER: listmonk\n",
    "      POSTGRES_PASSWORD: \"${DB_PASSWORD:?set DB_PASSWORD in .env.listmonk}\"\n",
    "      POSTGRES_DB: listmonk\n",
    "    volumes:\n",
    "      - listmonk_db:/var/lib/postgresql/data\n",
    "    healthcheck:\n",
    "      test: [\"CMD-SHELL\", \"pg_isready -U listmonk\"]\n",
    "      interval: 5s\n",
    "      timeout: 5s\n",
    "      retries: 5\n",
    "    restart: unless-stopped\n",
    "\n",
    "volumes:\n",
    "  caddy_data:\n",
    "  listmonk_db:\n",
);

pub(crate) const ENV_LISTMONK: &str = concat!(
    "# Copy to .env.listmonk and fill in real values before running docker compose.\n",
    "DB_PASSWORD=change-me\n",
    "SITE_URL=https://your-astropress-site.example.com\n",
);

pub(crate) const CADDYFILE_LISTMONK: &str = concat!(
    "# Caddy reverse proxy for Listmonk.\n",
    "# Strips X-Frame-Options: SAMEORIGIN so the Listmonk admin can be embedded\n",
    "# in the Astropress admin panel at /ap-admin/services/email.\n",
    "# SITE_URL must be set to your Astropress site's public URL (e.g. https://example.com).\n",
    "{\n",
    "    admin off\n",
    "}\n",
    "\n",
    ":80 {\n",
    "    reverse_proxy listmonk:9000 {\n",
    "        header_down -X-Frame-Options\n",
    "    }\n",
    "    header {\n",
    "        Content-Security-Policy \"frame-ancestors 'self' {$SITE_URL}\"\n",
    "    }\n",
    "}\n",
);

// ── Payload CMS ───────────────────────────────────────────────────────────────

const COMPOSE_PAYLOAD: &str = concat!(
    "# Payload CMS + Postgres.\n",
    "# Usage: cp .env.payload.example .env.payload && docker compose --env-file .env.payload up -d\n",
    "services:\n",
    "  payload:\n",
    "    image: node:20-alpine\n",
    "    working_dir: /app\n",
    "    command: sh -c \"npm install && npm run build && npm start\"\n",
    "    ports:\n",
    "      - \"3000:3000\"\n",
    "    environment:\n",
    "      DATABASE_URI: \"postgres://payload:${DB_PASSWORD}@db:5432/payload\"\n",
    "      PAYLOAD_SECRET: \"${PAYLOAD_SECRET:?set PAYLOAD_SECRET in .env.payload}\"\n",
    "      PAYLOAD_PUBLIC_SERVER_URL: \"${PAYLOAD_URL:-http://localhost:3000}\"\n",
    "    volumes:\n",
    "      - ../:/app\n",
    "    depends_on:\n",
    "      db:\n",
    "        condition: service_healthy\n",
    "    restart: unless-stopped\n",
    "\n",
    "  db:\n",
    "    image: postgres:16-alpine\n",
    "    environment:\n",
    "      POSTGRES_USER: payload\n",
    "      POSTGRES_PASSWORD: \"${DB_PASSWORD:?set DB_PASSWORD in .env.payload}\"\n",
    "      POSTGRES_DB: payload\n",
    "    volumes:\n",
    "      - payload_db:/var/lib/postgresql/data\n",
    "    healthcheck:\n",
    "      test: [\"CMD-SHELL\", \"pg_isready -U payload\"]\n",
    "      interval: 5s\n",
    "      timeout: 5s\n",
    "      retries: 5\n",
    "    restart: unless-stopped\n",
    "\n",
    "volumes:\n",
    "  payload_db:\n",
);
const ENV_PAYLOAD: &str = concat!(
    "DB_PASSWORD=change-me\n",
    "PAYLOAD_SECRET=change-me-long-random-string\n",
    "PAYLOAD_URL=https://cms.yourdomain.com\n",
);

// ── Meilisearch ───────────────────────────────────────────────────────────────

const COMPOSE_MEILISEARCH: &str = concat!(
    "# Meilisearch — typo-tolerant full-text search (MIT).\n",
    "# Usage: cp .env.meilisearch.example .env.meilisearch && docker compose --env-file .env.meilisearch up -d\n",
    "services:\n",
    "  meilisearch:\n",
    "    image: getmeili/meilisearch:latest\n",
    "    ports:\n",
    "      - \"7700:7700\"\n",
    "    environment:\n",
    "      MEILI_MASTER_KEY: \"${MEILI_MASTER_KEY:?set MEILI_MASTER_KEY in .env.meilisearch}\"\n",
    "    volumes:\n",
    "      - meili_data:/meili_data\n",
    "    restart: unless-stopped\n",
    "\n",
    "volumes:\n",
    "  meili_data:\n",
);
const ENV_MEILISEARCH: &str = concat!(
    "MEILI_MASTER_KEY=change-me-long-random-string\n",
);

// ── Remark42 ──────────────────────────────────────────────────────────────────

const COMPOSE_REMARK42: &str = concat!(
    "# Remark42 — self-hosted comments (MIT).\n",
    "# Usage: cp .env.remark42.example .env.remark42 && docker compose --env-file .env.remark42 up -d\n",
    "services:\n",
    "  remark42:\n",
    "    image: umputun/remark42:latest\n",
    "    ports:\n",
    "      - \"8080:8080\"\n",
    "    environment:\n",
    "      REMARK_URL: \"${REMARK_URL:?set REMARK_URL in .env.remark42}\"\n",
    "      SECRET: \"${REMARK_SECRET:?set REMARK_SECRET in .env.remark42}\"\n",
    "      AUTH_ANON: \"true\"\n",
    "    volumes:\n",
    "      - remark42_data:/srv/var\n",
    "    restart: unless-stopped\n",
    "\n",
    "volumes:\n",
    "  remark42_data:\n",
);
const ENV_REMARK42: &str = concat!(
    "REMARK_URL=https://comments.yourdomain.com\n",
    "REMARK_SECRET=change-me-long-random-string\n",
);

// ── Flarum ────────────────────────────────────────────────────────────────────

const COMPOSE_FLARUM: &str = concat!(
    "# Flarum — lightweight forum (MIT, PHP).\n",
    "# Usage: cp .env.flarum.example .env.flarum && docker compose --env-file .env.flarum up -d\n",
    "services:\n",
    "  flarum:\n",
    "    image: crazymax/flarum:latest\n",
    "    ports:\n",
    "      - \"8080:8000\"\n",
    "    environment:\n",
    "      DB_HOST: db\n",
    "      DB_NAME: flarum\n",
    "      DB_USER: flarum\n",
    "      DB_PASSWORD: \"${DB_PASSWORD:?set DB_PASSWORD in .env.flarum}\"\n",
    "      FLARUM_BASE_URL: \"${FLARUM_BASE_URL:?set FLARUM_BASE_URL in .env.flarum}\"\n",
    "    depends_on:\n",
    "      db:\n",
    "        condition: service_healthy\n",
    "    volumes:\n",
    "      - flarum_data:/data\n",
    "    restart: unless-stopped\n",
    "\n",
    "  db:\n",
    "    image: mysql:8\n",
    "    environment:\n",
    "      MYSQL_DATABASE: flarum\n",
    "      MYSQL_USER: flarum\n",
    "      MYSQL_PASSWORD: \"${DB_PASSWORD}\"\n",
    "      MYSQL_ROOT_PASSWORD: \"${DB_ROOT_PASSWORD:-rootpass}\"\n",
    "    volumes:\n",
    "      - flarum_db:/var/lib/mysql\n",
    "    healthcheck:\n",
    "      test: [\"CMD\", \"mysqladmin\", \"ping\", \"-h\", \"localhost\"]\n",
    "      interval: 5s\n",
    "      timeout: 5s\n",
    "      retries: 10\n",
    "    restart: unless-stopped\n",
    "\n",
    "volumes:\n",
    "  flarum_data:\n",
    "  flarum_db:\n",
);
const ENV_FLARUM: &str = concat!(
    "DB_PASSWORD=change-me\n",
    "DB_ROOT_PASSWORD=change-me-root\n",
    "FLARUM_BASE_URL=https://forum.yourdomain.com\n",
);

// ── Discourse ─────────────────────────────────────────────────────────────────

const COMPOSE_DISCOURSE: &str = concat!(
    "# Discourse — mature forum (GPL 2.0, Ruby).\n",
    "# ⚠ Discourse officially recommends its own install script (discourse-setup),\n",
    "#   not a custom docker-compose. Use the official guide:\n",
    "#   https://github.com/discourse/discourse/blob/main/docs/INSTALL-cloud.md\n",
    "#\n",
    "# Minimum requirements: 2 GB RAM, 2 CPUs (Fly.io performance-2x or Railway Pro).\n",
    "#\n",
    "# Lightweight alternative: use Flarum (see above) — much lower resource footprint.\n",
    "services:\n",
    "  discourse:\n",
    "    image: discourse/base:release\n",
    "    ports:\n",
    "      - \"80:80\"\n",
    "      - \"443:443\"\n",
    "    environment:\n",
    "      DISCOURSE_HOSTNAME: \"${DISCOURSE_URL:?set DISCOURSE_URL in .env.discourse}\"\n",
    "      DISCOURSE_DEVELOPER_EMAILS: \"${ADMIN_EMAIL:?set ADMIN_EMAIL in .env.discourse}\"\n",
    "      DISCOURSE_SMTP_ADDRESS: \"${SMTP_HOST:?set SMTP_HOST in .env.discourse}\"\n",
    "      DISCOURSE_SMTP_PORT: \"${SMTP_PORT:-587}\"\n",
    "      DISCOURSE_SMTP_USER_NAME: \"${SMTP_USER}\"\n",
    "      DISCOURSE_SMTP_PASSWORD: \"${SMTP_PASSWORD}\"\n",
    "    volumes:\n",
    "      - discourse_data:/var/www/discourse/public/uploads\n",
    "    restart: unless-stopped\n",
    "\n",
    "volumes:\n",
    "  discourse_data:\n",
);
const ENV_DISCOURSE: &str = concat!(
    "DISCOURSE_URL=forum.yourdomain.com\n",
    "ADMIN_EMAIL=admin@yourdomain.com\n",
    "SMTP_HOST=smtp-relay.brevo.com\n",
    "SMTP_PORT=587\n",
    "SMTP_USER=your-brevo-login@example.com\n",
    "SMTP_PASSWORD=your-brevo-smtp-key\n",
);

// ── Tiledesk ──────────────────────────────────────────────────────────────────

const COMPOSE_TILEDESK: &str = concat!(
    "# Tiledesk — live chat + helpdesk (Apache 2.0).\n",
    "# Full compose: https://github.com/Tiledesk/tiledesk-deployment\n",
    "# Usage: cp .env.tiledesk.example .env.tiledesk && docker compose --env-file .env.tiledesk up -d\n",
    "services:\n",
    "  tiledesk:\n",
    "    image: tiledesk/tiledesk-server:latest\n",
    "    ports:\n",
    "      - \"8080:8080\"\n",
    "    environment:\n",
    "      MONGODB_URI: \"mongodb://mongo:27017/tiledesk\"\n",
    "      JWT_SECRET: \"${JWT_SECRET:?set JWT_SECRET in .env.tiledesk}\"\n",
    "      APP_BASE_URL: \"${TILEDESK_URL:?set TILEDESK_URL in .env.tiledesk}\"\n",
    "    depends_on:\n",
    "      - mongo\n",
    "    restart: unless-stopped\n",
    "\n",
    "  mongo:\n",
    "    image: mongo:6\n",
    "    volumes:\n",
    "      - tiledesk_db:/data/db\n",
    "    restart: unless-stopped\n",
    "\n",
    "volumes:\n",
    "  tiledesk_db:\n",
);
const ENV_TILEDESK: &str = concat!(
    "JWT_SECRET=change-me-long-random-string\n",
    "TILEDESK_URL=https://chat.yourdomain.com\n",
);

// ── HyperSwitch ───────────────────────────────────────────────────────────────

const COMPOSE_HYPERSWITCH: &str = concat!(
    "# HyperSwitch — open-source payment orchestration (Apache 2.0).\n",
    "# Full deployment guide: https://docs.hyperswitch.io/hyperswitch-open-source/deploy-hyperswitch\n",
    "# Usage: cp .env.hyperswitch.example .env.hyperswitch && docker compose --env-file .env.hyperswitch up -d\n",
    "services:\n",
    "  hyperswitch-server:\n",
    "    image: juspaydotin/hyperswitch-router:latest\n",
    "    ports:\n",
    "      - \"8080:8080\"\n",
    "    environment:\n",
    "      ROUTER__SERVER__BASE_URL: \"${HYPERSWITCH_BASE_URL:?set HYPERSWITCH_BASE_URL}\"\n",
    "      ROUTER__MASTER_DATABASE__URL: \"postgres://hs:${DB_PASSWORD}@db:5432/hyperswitch\"\n",
    "      ROUTER__SECRETS__JWT_SECRET: \"${JWT_SECRET:?set JWT_SECRET}\"\n",
    "      ROUTER__SECRETS__ADMIN_API_KEY: \"${HYPERSWITCH_API_KEY:?set HYPERSWITCH_API_KEY}\"\n",
    "    depends_on:\n",
    "      db:\n",
    "        condition: service_healthy\n",
    "      redis:\n",
    "        condition: service_started\n",
    "    restart: unless-stopped\n",
    "\n",
    "  db:\n",
    "    image: postgres:16-alpine\n",
    "    environment:\n",
    "      POSTGRES_USER: hs\n",
    "      POSTGRES_PASSWORD: \"${DB_PASSWORD:?set DB_PASSWORD}\"\n",
    "      POSTGRES_DB: hyperswitch\n",
    "    volumes:\n",
    "      - hs_db:/var/lib/postgresql/data\n",
    "    healthcheck:\n",
    "      test: [\"CMD-SHELL\", \"pg_isready -U hs\"]\n",
    "      interval: 5s\n",
    "      timeout: 5s\n",
    "      retries: 5\n",
    "    restart: unless-stopped\n",
    "\n",
    "  redis:\n",
    "    image: redis:7-alpine\n",
    "    restart: unless-stopped\n",
    "\n",
    "volumes:\n",
    "  hs_db:\n",
);
const ENV_HYPERSWITCH: &str = concat!(
    "DB_PASSWORD=change-me\n",
    "JWT_SECRET=change-me-long-random-string\n",
    "HYPERSWITCH_API_KEY=change-me\n",
    "HYPERSWITCH_BASE_URL=https://payments.yourdomain.com\n",
);

// ── Rallly ────────────────────────────────────────────────────────────────────

const COMPOSE_RALLLY: &str = concat!(
    "# Rallly — availability polling / group scheduling (MIT).\n",
    "# Usage: cp .env.rallly.example .env.rallly && docker compose --env-file .env.rallly up -d\n",
    "services:\n",
    "  rallly:\n",
    "    image: lukevella/rallly:latest\n",
    "    ports:\n",
    "      - \"3000:3000\"\n",
    "    environment:\n",
    "      DATABASE_URL: \"postgres://rallly:${DB_PASSWORD}@db:5432/rallly\"\n",
    "      SECRET_PASSWORD: \"${SECRET_PASSWORD:?set SECRET_PASSWORD in .env.rallly}\"\n",
    "      NEXT_PUBLIC_BASE_URL: \"${RALLLY_URL:?set RALLLY_URL in .env.rallly}\"\n",
    "      SMTP_HOST: \"${SMTP_HOST}\"\n",
    "      SMTP_PORT: \"${SMTP_PORT:-587}\"\n",
    "      SMTP_USER: \"${SMTP_USER}\"\n",
    "      SMTP_PWD: \"${SMTP_PASSWORD}\"\n",
    "      SUPPORT_EMAIL: \"${SUPPORT_EMAIL}\"\n",
    "    depends_on:\n",
    "      db:\n",
    "        condition: service_healthy\n",
    "    restart: unless-stopped\n",
    "\n",
    "  db:\n",
    "    image: postgres:16-alpine\n",
    "    environment:\n",
    "      POSTGRES_USER: rallly\n",
    "      POSTGRES_PASSWORD: \"${DB_PASSWORD:?set DB_PASSWORD in .env.rallly}\"\n",
    "      POSTGRES_DB: rallly\n",
    "    volumes:\n",
    "      - rallly_db:/var/lib/postgresql/data\n",
    "    healthcheck:\n",
    "      test: [\"CMD-SHELL\", \"pg_isready -U rallly\"]\n",
    "      interval: 5s\n",
    "      timeout: 5s\n",
    "      retries: 5\n",
    "    restart: unless-stopped\n",
    "\n",
    "volumes:\n",
    "  rallly_db:\n",
);
const ENV_RALLLY: &str = concat!(
    "DB_PASSWORD=change-me\n",
    "SECRET_PASSWORD=change-me-long-random-string\n",
    "RALLLY_URL=https://schedule.yourdomain.com\n",
    "SMTP_HOST=smtp-relay.brevo.com\n",
    "SMTP_PORT=587\n",
    "SMTP_USER=your-brevo-login@example.com\n",
    "SMTP_PASSWORD=your-brevo-smtp-key\n",
    "SUPPORT_EMAIL=support@yourdomain.com\n",
);

// ── Cal.com ───────────────────────────────────────────────────────────────────

const COMPOSE_CALCOM: &str = concat!(
    "# Cal.com — open-source scheduling (AGPL 3.0).\n",
    "# Official self-host guide: https://cal.com/docs/self-hosting/docker\n",
    "# Free cloud tier available at https://cal.com (recommended for small teams).\n",
    "# Usage: cp .env.calcom.example .env.calcom && docker compose --env-file .env.calcom up -d\n",
    "services:\n",
    "  calcom:\n",
    "    image: calcom/cal.com:latest\n",
    "    ports:\n",
    "      - \"3000:3000\"\n",
    "    environment:\n",
    "      DATABASE_URL: \"postgresql://calcom:${DB_PASSWORD}@db:5432/calcom\"\n",
    "      NEXTAUTH_SECRET: \"${NEXTAUTH_SECRET:?set NEXTAUTH_SECRET in .env.calcom}\"\n",
    "      CALENDSO_ENCRYPTION_KEY: \"${ENCRYPTION_KEY:?set ENCRYPTION_KEY in .env.calcom}\"\n",
    "      NEXT_PUBLIC_WEBAPP_URL: \"${CALCOM_URL:?set CALCOM_URL in .env.calcom}\"\n",
    "      EMAIL_FROM: \"${EMAIL_FROM}\"\n",
    "      EMAIL_SERVER_HOST: \"${SMTP_HOST}\"\n",
    "      EMAIL_SERVER_PORT: \"${SMTP_PORT:-587}\"\n",
    "      EMAIL_SERVER_USER: \"${SMTP_USER}\"\n",
    "      EMAIL_SERVER_PASSWORD: \"${SMTP_PASSWORD}\"\n",
    "    depends_on:\n",
    "      db:\n",
    "        condition: service_healthy\n",
    "    restart: unless-stopped\n",
    "\n",
    "  db:\n",
    "    image: postgres:16-alpine\n",
    "    environment:\n",
    "      POSTGRES_USER: calcom\n",
    "      POSTGRES_PASSWORD: \"${DB_PASSWORD:?set DB_PASSWORD in .env.calcom}\"\n",
    "      POSTGRES_DB: calcom\n",
    "    volumes:\n",
    "      - calcom_db:/var/lib/postgresql/data\n",
    "    healthcheck:\n",
    "      test: [\"CMD-SHELL\", \"pg_isready -U calcom\"]\n",
    "      interval: 5s\n",
    "      timeout: 5s\n",
    "      retries: 5\n",
    "    restart: unless-stopped\n",
    "\n",
    "volumes:\n",
    "  calcom_db:\n",
);
const ENV_CALCOM: &str = concat!(
    "DB_PASSWORD=change-me\n",
    "NEXTAUTH_SECRET=change-me-32-char-random-string\n",
    "ENCRYPTION_KEY=change-me-32-char-random-string\n",
    "CALCOM_URL=https://cal.yourdomain.com\n",
    "EMAIL_FROM=noreply@yourdomain.com\n",
    "SMTP_HOST=smtp-relay.brevo.com\n",
    "SMTP_PORT=587\n",
    "SMTP_USER=your-brevo-login@example.com\n",
    "SMTP_PASSWORD=your-brevo-smtp-key\n",
);

// ── Gotify ────────────────────────────────────────────────────────────────────

const COMPOSE_GOTIFY: &str = concat!(
    "# Gotify — self-hosted push notifications (MIT).\n",
    "# Usage: cp .env.gotify.example .env.gotify && docker compose --env-file .env.gotify up -d\n",
    "services:\n",
    "  gotify:\n",
    "    image: gotify/server:latest\n",
    "    ports:\n",
    "      - \"80:80\"\n",
    "    environment:\n",
    "      GOTIFY_DEFAULTUSER_PASS: \"${GOTIFY_ADMIN_PASS:?set GOTIFY_ADMIN_PASS in .env.gotify}\"\n",
    "    volumes:\n",
    "      - gotify_data:/app/data\n",
    "    restart: unless-stopped\n",
    "\n",
    "volumes:\n",
    "  gotify_data:\n",
);
const ENV_GOTIFY: &str = concat!(
    "GOTIFY_ADMIN_PASS=change-me\n",
);

// ── Medusa ────────────────────────────────────────────────────────────────────

const COMPOSE_MEDUSA: &str = concat!(
    "# Medusa — headless commerce (MIT).\n",
    "# Usage: cp .env.medusa.example .env.medusa && docker compose --env-file .env.medusa up -d\n",
    "services:\n",
    "  medusa:\n",
    "    image: node:20-alpine\n",
    "    working_dir: /app\n",
    "    command: sh -c \"npm install && npm run build && npm start\"\n",
    "    ports:\n",
    "      - \"9000:9000\"\n",
    "    environment:\n",
    "      DATABASE_URL: \"postgres://medusa:${DB_PASSWORD}@db:5432/medusa\"\n",
    "      REDIS_URL: \"redis://redis:6379\"\n",
    "      JWT_SECRET: \"${JWT_SECRET:?set JWT_SECRET in .env.medusa}\"\n",
    "      COOKIE_SECRET: \"${COOKIE_SECRET:?set COOKIE_SECRET in .env.medusa}\"\n",
    "    volumes:\n",
    "      - ../:/app\n",
    "    depends_on:\n",
    "      db:\n",
    "        condition: service_healthy\n",
    "      redis:\n",
    "        condition: service_started\n",
    "    restart: unless-stopped\n",
    "\n",
    "  db:\n",
    "    image: postgres:16-alpine\n",
    "    environment:\n",
    "      POSTGRES_USER: medusa\n",
    "      POSTGRES_PASSWORD: \"${DB_PASSWORD:?set DB_PASSWORD in .env.medusa}\"\n",
    "      POSTGRES_DB: medusa\n",
    "    volumes:\n",
    "      - medusa_db:/var/lib/postgresql/data\n",
    "    healthcheck:\n",
    "      test: [\"CMD-SHELL\", \"pg_isready -U medusa\"]\n",
    "      interval: 5s\n",
    "      timeout: 5s\n",
    "      retries: 5\n",
    "    restart: unless-stopped\n",
    "\n",
    "  redis:\n",
    "    image: redis:7-alpine\n",
    "    restart: unless-stopped\n",
    "\n",
    "volumes:\n",
    "  medusa_db:\n",
);
const ENV_MEDUSA: &str = concat!(
    "DB_PASSWORD=change-me\n",
    "JWT_SECRET=change-me-long-random-string\n",
    "COOKIE_SECRET=change-me-long-random-string\n",
);

// ── Vendure ───────────────────────────────────────────────────────────────────

const COMPOSE_VENDURE: &str = concat!(
    "# Vendure — TypeScript-first headless commerce (MIT).\n",
    "# Usage: cp .env.vendure.example .env.vendure && docker compose --env-file .env.vendure up -d\n",
    "services:\n",
    "  vendure:\n",
    "    image: node:20-alpine\n",
    "    working_dir: /app\n",
    "    command: sh -c \"npm install && npm run build && npm start\"\n",
    "    ports:\n",
    "      - \"3000:3000\"\n",
    "    environment:\n",
    "      DB_HOST: db\n",
    "      DB_PORT: \"5432\"\n",
    "      DB_USERNAME: vendure\n",
    "      DB_PASSWORD: \"${DB_PASSWORD:?set DB_PASSWORD in .env.vendure}\"\n",
    "      DB_NAME: vendure\n",
    "      SUPERADMIN_USERNAME: \"${SUPERADMIN_USERNAME:-superadmin}\"\n",
    "      SUPERADMIN_PASSWORD: \"${SUPERADMIN_PASSWORD:?set SUPERADMIN_PASSWORD in .env.vendure}\"\n",
    "    volumes:\n",
    "      - ../:/app\n",
    "    depends_on:\n",
    "      db:\n",
    "        condition: service_healthy\n",
    "    restart: unless-stopped\n",
    "\n",
    "  db:\n",
    "    image: postgres:16-alpine\n",
    "    environment:\n",
    "      POSTGRES_USER: vendure\n",
    "      POSTGRES_PASSWORD: \"${DB_PASSWORD}\"\n",
    "      POSTGRES_DB: vendure\n",
    "    volumes:\n",
    "      - vendure_db:/var/lib/postgresql/data\n",
    "    healthcheck:\n",
    "      test: [\"CMD-SHELL\", \"pg_isready -U vendure\"]\n",
    "      interval: 5s\n",
    "      timeout: 5s\n",
    "      retries: 5\n",
    "    restart: unless-stopped\n",
    "\n",
    "volumes:\n",
    "  vendure_db:\n",
);
const ENV_VENDURE: &str = concat!(
    "DB_PASSWORD=change-me\n",
    "SUPERADMIN_PASSWORD=change-me\n",
);

// ── Typebot ───────────────────────────────────────────────────────────────────

const COMPOSE_TYPEBOT: &str = concat!(
    "# Typebot — conversational forms + chatbot builder (AGPL 3.0).\n",
    "# Free cloud tier at https://typebot.io (recommended for most users).\n",
    "# Usage: cp .env.typebot.example .env.typebot && docker compose --env-file .env.typebot up -d\n",
    "services:\n",
    "  typebot-builder:\n",
    "    image: baptistearno/typebot-builder:latest\n",
    "    ports:\n",
    "      - \"3000:3000\"\n",
    "    environment:\n",
    "      DATABASE_URL: \"postgresql://typebot:${DB_PASSWORD}@db:5432/typebot\"\n",
    "      NEXTAUTH_URL: \"${TYPEBOT_BUILDER_URL:?set TYPEBOT_BUILDER_URL in .env.typebot}\"\n",
    "      NEXTAUTH_SECRET: \"${NEXTAUTH_SECRET:?set NEXTAUTH_SECRET in .env.typebot}\"\n",
    "      ENCRYPTION_SECRET: \"${ENCRYPTION_SECRET:?set ENCRYPTION_SECRET in .env.typebot}\"\n",
    "    depends_on:\n",
    "      db:\n",
    "        condition: service_healthy\n",
    "    restart: unless-stopped\n",
    "\n",
    "  typebot-viewer:\n",
    "    image: baptistearno/typebot-viewer:latest\n",
    "    ports:\n",
    "      - \"3001:3000\"\n",
    "    environment:\n",
    "      DATABASE_URL: \"postgresql://typebot:${DB_PASSWORD}@db:5432/typebot\"\n",
    "      NEXTAUTH_URL: \"${TYPEBOT_VIEWER_URL:?set TYPEBOT_VIEWER_URL in .env.typebot}\"\n",
    "      NEXTAUTH_SECRET: \"${NEXTAUTH_SECRET}\"\n",
    "      ENCRYPTION_SECRET: \"${ENCRYPTION_SECRET}\"\n",
    "    depends_on:\n",
    "      db:\n",
    "        condition: service_healthy\n",
    "    restart: unless-stopped\n",
    "\n",
    "  db:\n",
    "    image: postgres:16-alpine\n",
    "    environment:\n",
    "      POSTGRES_USER: typebot\n",
    "      POSTGRES_PASSWORD: \"${DB_PASSWORD:?set DB_PASSWORD in .env.typebot}\"\n",
    "      POSTGRES_DB: typebot\n",
    "    volumes:\n",
    "      - typebot_db:/var/lib/postgresql/data\n",
    "    healthcheck:\n",
    "      test: [\"CMD-SHELL\", \"pg_isready -U typebot\"]\n",
    "      interval: 5s\n",
    "      timeout: 5s\n",
    "      retries: 5\n",
    "    restart: unless-stopped\n",
    "\n",
    "volumes:\n",
    "  typebot_db:\n",
);
const ENV_TYPEBOT: &str = concat!(
    "DB_PASSWORD=change-me\n",
    "NEXTAUTH_SECRET=change-me-32-char-random-string\n",
    "ENCRYPTION_SECRET=change-me-32-char-random-string\n",
    "TYPEBOT_BUILDER_URL=https://typebot.yourdomain.com\n",
    "TYPEBOT_VIEWER_URL=https://bot.yourdomain.com\n",
);

// ── Formbricks ────────────────────────────────────────────────────────────────

const COMPOSE_FORMBRICKS: &str = concat!(
    "# Formbricks — surveys + NPS + testimonials (MIT community edition).\n",
    "# Free cloud tier at https://formbricks.com (recommended for most users).\n",
    "# Usage: cp .env.formbricks.example .env.formbricks && docker compose --env-file .env.formbricks up -d\n",
    "services:\n",
    "  formbricks:\n",
    "    image: formbricks/formbricks:latest\n",
    "    ports:\n",
    "      - \"3000:3000\"\n",
    "    environment:\n",
    "      DATABASE_URL: \"postgresql://formbricks:${DB_PASSWORD}@db:5432/formbricks\"\n",
    "      NEXTAUTH_URL: \"${FORMBRICKS_URL:?set FORMBRICKS_URL in .env.formbricks}\"\n",
    "      NEXTAUTH_SECRET: \"${NEXTAUTH_SECRET:?set NEXTAUTH_SECRET in .env.formbricks}\"\n",
    "      ENCRYPTION_KEY: \"${ENCRYPTION_KEY:?set ENCRYPTION_KEY in .env.formbricks}\"\n",
    "    depends_on:\n",
    "      db:\n",
    "        condition: service_healthy\n",
    "    restart: unless-stopped\n",
    "\n",
    "  db:\n",
    "    image: postgres:16-alpine\n",
    "    environment:\n",
    "      POSTGRES_USER: formbricks\n",
    "      POSTGRES_PASSWORD: \"${DB_PASSWORD:?set DB_PASSWORD in .env.formbricks}\"\n",
    "      POSTGRES_DB: formbricks\n",
    "    volumes:\n",
    "      - formbricks_db:/var/lib/postgresql/data\n",
    "    healthcheck:\n",
    "      test: [\"CMD-SHELL\", \"pg_isready -U formbricks\"]\n",
    "      interval: 5s\n",
    "      timeout: 5s\n",
    "      retries: 5\n",
    "    restart: unless-stopped\n",
    "\n",
    "volumes:\n",
    "  formbricks_db:\n",
);
const ENV_FORMBRICKS: &str = concat!(
    "DB_PASSWORD=change-me\n",
    "NEXTAUTH_SECRET=change-me-32-char-random-string\n",
    "ENCRYPTION_KEY=change-me-32-char-random-string\n",
    "FORMBRICKS_URL=https://forms.yourdomain.com\n",
);

// ── PeerTube ──────────────────────────────────────────────────────────────────

const COMPOSE_PEERTUBE: &str = concat!(
    "# PeerTube — self-hosted video with ActivityPub (AGPL 3.0).\n",
    "# ⚠ Video files need object storage (Cloudflare R2 or Tigris) — local disk fills up fast.\n",
    "# Full guide: https://docs.joinpeertube.org/install/docker\n",
    "# Usage: cp .env.peertube.example .env.peertube && docker compose --env-file .env.peertube up -d\n",
    "services:\n",
    "  peertube:\n",
    "    image: chocobozzz/peertube:production-bookworm\n",
    "    ports:\n",
    "      - \"9000:9000\"\n",
    "      - \"1935:1935\"  # RTMP live streaming\n",
    "    environment:\n",
    "      PEERTUBE_DB_HOSTNAME: db\n",
    "      PEERTUBE_DB_USERNAME: peertube\n",
    "      PEERTUBE_DB_PASSWORD: \"${DB_PASSWORD:?set DB_PASSWORD in .env.peertube}\"\n",
    "      PEERTUBE_DB_NAME: peertube\n",
    "      PEERTUBE_REDIS_HOSTNAME: redis\n",
    "      PEERTUBE_SMTP_HOSTNAME: \"${SMTP_HOST}\"\n",
    "      PEERTUBE_SMTP_PORT: \"${SMTP_PORT:-587}\"\n",
    "      PEERTUBE_SMTP_USERNAME: \"${SMTP_USER}\"\n",
    "      PEERTUBE_SMTP_PASSWORD: \"${SMTP_PASSWORD}\"\n",
    "      PEERTUBE_SMTP_FROM: \"${SMTP_FROM}\"\n",
    "      PEERTUBE_WEBSERVER_HOSTNAME: \"${PEERTUBE_HOSTNAME:?set PEERTUBE_HOSTNAME in .env.peertube}\"\n",
    "      PEERTUBE_OBJECT_STORAGE_ENABLED: \"${OBJECT_STORAGE_ENABLED:-false}\"\n",
    "      PEERTUBE_OBJECT_STORAGE_ENDPOINT: \"${R2_ENDPOINT}\"\n",
    "      PEERTUBE_OBJECT_STORAGE_CREDENTIALS_ACCESS_KEY_ID: \"${R2_ACCESS_KEY_ID}\"\n",
    "      PEERTUBE_OBJECT_STORAGE_CREDENTIALS_SECRET_ACCESS_KEY: \"${R2_SECRET_ACCESS_KEY}\"\n",
    "    volumes:\n",
    "      - peertube_data:/data\n",
    "    depends_on:\n",
    "      db:\n",
    "        condition: service_healthy\n",
    "      redis:\n",
    "        condition: service_started\n",
    "    restart: unless-stopped\n",
    "\n",
    "  db:\n",
    "    image: postgres:16-alpine\n",
    "    environment:\n",
    "      POSTGRES_USER: peertube\n",
    "      POSTGRES_PASSWORD: \"${DB_PASSWORD}\"\n",
    "      POSTGRES_DB: peertube\n",
    "    volumes:\n",
    "      - peertube_db:/var/lib/postgresql/data\n",
    "    healthcheck:\n",
    "      test: [\"CMD-SHELL\", \"pg_isready -U peertube\"]\n",
    "      interval: 5s\n",
    "      timeout: 5s\n",
    "      retries: 5\n",
    "    restart: unless-stopped\n",
    "\n",
    "  redis:\n",
    "    image: redis:7-alpine\n",
    "    restart: unless-stopped\n",
    "\n",
    "volumes:\n",
    "  peertube_data:\n",
    "  peertube_db:\n",
);
const ENV_PEERTUBE: &str = concat!(
    "DB_PASSWORD=change-me\n",
    "PEERTUBE_HOSTNAME=video.yourdomain.com\n",
    "SMTP_HOST=smtp-relay.brevo.com\n",
    "SMTP_PORT=587\n",
    "SMTP_USER=your-brevo-login@example.com\n",
    "SMTP_PASSWORD=your-brevo-smtp-key\n",
    "SMTP_FROM=noreply@yourdomain.com\n",
    "# Object storage (Cloudflare R2 — free 10 GB/month egress)\n",
    "OBJECT_STORAGE_ENABLED=true\n",
    "R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com\n",
    "R2_ACCESS_KEY_ID=replace-me\n",
    "R2_SECRET_ACCESS_KEY=replace-me\n",
);

// ── Castopod ──────────────────────────────────────────────────────────────────

const COMPOSE_CASTOPOD: &str = concat!(
    "# Castopod — self-hosted podcast hosting (AGPL 3.0).\n",
    "# ⚠ Audio files need object storage (Cloudflare R2 or Tigris) — local disk fills up fast.\n",
    "# Usage: cp .env.castopod.example .env.castopod && docker compose --env-file .env.castopod up -d\n",
    "services:\n",
    "  castopod:\n",
    "    image: castopod/castopod:latest\n",
    "    ports:\n",
    "      - \"8000:8000\"\n",
    "    environment:\n",
    "      CP_BASEURL: \"${CASTOPOD_URL:?set CASTOPOD_URL in .env.castopod}\"\n",
    "      CP_DATABASE_HOSTNAME: db\n",
    "      CP_DATABASE_NAME: castopod\n",
    "      CP_DATABASE_USERNAME: castopod\n",
    "      CP_DATABASE_PASSWORD: \"${DB_PASSWORD:?set DB_PASSWORD in .env.castopod}\"\n",
    "      CP_MEDIA_BASE_URL: \"${MEDIA_BASE_URL}\"\n",
    "      CP_EMAIL_SMTPHost: \"${SMTP_HOST}\"\n",
    "      CP_EMAIL_SMTPPort: \"${SMTP_PORT:-587}\"\n",
    "      CP_EMAIL_SMTPCrypto: tls\n",
    "      CP_EMAIL_SMTPUser: \"${SMTP_USER}\"\n",
    "      CP_EMAIL_SMTPPass: \"${SMTP_PASSWORD}\"\n",
    "      CP_EMAIL_fromEmail: \"${SMTP_FROM}\"\n",
    "    volumes:\n",
    "      - castopod_media:/var/www/castopod/public/media\n",
    "    depends_on:\n",
    "      db:\n",
    "        condition: service_healthy\n",
    "    restart: unless-stopped\n",
    "\n",
    "  db:\n",
    "    image: mysql:8\n",
    "    environment:\n",
    "      MYSQL_DATABASE: castopod\n",
    "      MYSQL_USER: castopod\n",
    "      MYSQL_PASSWORD: \"${DB_PASSWORD}\"\n",
    "      MYSQL_ROOT_PASSWORD: \"${DB_ROOT_PASSWORD:-rootpass}\"\n",
    "    volumes:\n",
    "      - castopod_db:/var/lib/mysql\n",
    "    healthcheck:\n",
    "      test: [\"CMD\", \"mysqladmin\", \"ping\", \"-h\", \"localhost\"]\n",
    "      interval: 5s\n",
    "      timeout: 5s\n",
    "      retries: 10\n",
    "    restart: unless-stopped\n",
    "\n",
    "volumes:\n",
    "  castopod_media:\n",
    "  castopod_db:\n",
);
const ENV_CASTOPOD: &str = concat!(
    "DB_PASSWORD=change-me\n",
    "DB_ROOT_PASSWORD=change-me-root\n",
    "CASTOPOD_URL=https://podcast.yourdomain.com\n",
    "MEDIA_BASE_URL=https://podcast.yourdomain.com\n",
    "SMTP_HOST=smtp-relay.brevo.com\n",
    "SMTP_PORT=587\n",
    "SMTP_USER=your-brevo-login@example.com\n",
    "SMTP_PASSWORD=your-brevo-smtp-key\n",
    "SMTP_FROM=noreply@yourdomain.com\n",
);

// ── Hi.Events ─────────────────────────────────────────────────────────────────

const COMPOSE_HIEVENTS: &str = concat!(
    "# Hi.Events — event management + ticketing (AGPL 3.0).\n",
    "# Usage: cp .env.hievents.example .env.hievents && docker compose --env-file .env.hievents up -d\n",
    "services:\n",
    "  hievents:\n",
    "    image: drizzer/hievents:latest\n",
    "    ports:\n",
    "      - \"8080:8080\"\n",
    "    environment:\n",
    "      DB_CONNECTION: pgsql\n",
    "      DB_HOST: db\n",
    "      DB_PORT: \"5432\"\n",
    "      DB_DATABASE: hievents\n",
    "      DB_USERNAME: hievents\n",
    "      DB_PASSWORD: \"${DB_PASSWORD:?set DB_PASSWORD in .env.hievents}\"\n",
    "      APP_KEY: \"${APP_KEY:?set APP_KEY in .env.hievents}\"\n",
    "      APP_URL: \"${HIEVENTS_URL:?set HIEVENTS_URL in .env.hievents}\"\n",
    "      MAIL_MAILER: smtp\n",
    "      MAIL_HOST: \"${SMTP_HOST}\"\n",
    "      MAIL_PORT: \"${SMTP_PORT:-587}\"\n",
    "      MAIL_USERNAME: \"${SMTP_USER}\"\n",
    "      MAIL_PASSWORD: \"${SMTP_PASSWORD}\"\n",
    "      MAIL_FROM_ADDRESS: \"${SMTP_FROM}\"\n",
    "    depends_on:\n",
    "      db:\n",
    "        condition: service_healthy\n",
    "    restart: unless-stopped\n",
    "\n",
    "  db:\n",
    "    image: postgres:16-alpine\n",
    "    environment:\n",
    "      POSTGRES_USER: hievents\n",
    "      POSTGRES_PASSWORD: \"${DB_PASSWORD}\"\n",
    "      POSTGRES_DB: hievents\n",
    "    volumes:\n",
    "      - hievents_db:/var/lib/postgresql/data\n",
    "    healthcheck:\n",
    "      test: [\"CMD-SHELL\", \"pg_isready -U hievents\"]\n",
    "      interval: 5s\n",
    "      timeout: 5s\n",
    "      retries: 5\n",
    "    restart: unless-stopped\n",
    "\n",
    "volumes:\n",
    "  hievents_db:\n",
);
const ENV_HIEVENTS: &str = concat!(
    "DB_PASSWORD=change-me\n",
    "APP_KEY=base64:change-me-32-char-random-string\n",
    "HIEVENTS_URL=https://events.yourdomain.com\n",
    "SMTP_HOST=smtp-relay.brevo.com\n",
    "SMTP_PORT=587\n",
    "SMTP_USER=your-brevo-login@example.com\n",
    "SMTP_PASSWORD=your-brevo-smtp-key\n",
    "SMTP_FROM=noreply@yourdomain.com\n",
);

// ── Pretix ────────────────────────────────────────────────────────────────────

const COMPOSE_PRETIX: &str = concat!(
    "# Pretix — event ticketing with seating charts (Apache 2.0).\n",
    "# Full guide: https://docs.pretix.eu/en/latest/admin/installation/docker_smallscale.html\n",
    "# Usage: cp .env.pretix.example .env.pretix && docker compose --env-file .env.pretix up -d\n",
    "services:\n",
    "  pretix:\n",
    "    image: pretix/standalone:stable\n",
    "    ports:\n",
    "      - \"80:80\"\n",
    "    environment:\n",
    "      PRETIX_SITE_URL: \"${PRETIX_URL:?set PRETIX_URL in .env.pretix}\"\n",
    "      PRETIX_DATABASE_BACKEND: postgresql\n",
    "      PRETIX_DATABASE_HOST: db\n",
    "      PRETIX_DATABASE_NAME: pretix\n",
    "      PRETIX_DATABASE_USER: pretix\n",
    "      PRETIX_DATABASE_PASSWORD: \"${DB_PASSWORD:?set DB_PASSWORD in .env.pretix}\"\n",
    "      PRETIX_REDIS_LOCATION: \"redis://redis:6379/0\"\n",
    "      PRETIX_CELERY_BROKER: \"redis://redis:6379/1\"\n",
    "      PRETIX_MAIL_FROM: \"${SMTP_FROM}\"\n",
    "      PRETIX_MAIL_HOST: \"${SMTP_HOST}\"\n",
    "      PRETIX_MAIL_PORT: \"${SMTP_PORT:-587}\"\n",
    "      PRETIX_MAIL_TLS: \"true\"\n",
    "      PRETIX_MAIL_USER: \"${SMTP_USER}\"\n",
    "      PRETIX_MAIL_PASSWORD: \"${SMTP_PASSWORD}\"\n",
    "    volumes:\n",
    "      - pretix_data:/data\n",
    "    depends_on:\n",
    "      db:\n",
    "        condition: service_healthy\n",
    "      redis:\n",
    "        condition: service_started\n",
    "    restart: unless-stopped\n",
    "\n",
    "  db:\n",
    "    image: postgres:16-alpine\n",
    "    environment:\n",
    "      POSTGRES_USER: pretix\n",
    "      POSTGRES_PASSWORD: \"${DB_PASSWORD}\"\n",
    "      POSTGRES_DB: pretix\n",
    "    volumes:\n",
    "      - pretix_db:/var/lib/postgresql/data\n",
    "    healthcheck:\n",
    "      test: [\"CMD-SHELL\", \"pg_isready -U pretix\"]\n",
    "      interval: 5s\n",
    "      timeout: 5s\n",
    "      retries: 5\n",
    "    restart: unless-stopped\n",
    "\n",
    "  redis:\n",
    "    image: redis:7-alpine\n",
    "    restart: unless-stopped\n",
    "\n",
    "volumes:\n",
    "  pretix_data:\n",
    "  pretix_db:\n",
);
const ENV_PRETIX: &str = concat!(
    "DB_PASSWORD=change-me\n",
    "PRETIX_URL=https://tickets.yourdomain.com\n",
    "SMTP_HOST=smtp-relay.brevo.com\n",
    "SMTP_PORT=587\n",
    "SMTP_USER=your-brevo-login@example.com\n",
    "SMTP_PASSWORD=your-brevo-smtp-key\n",
    "SMTP_FROM=noreply@yourdomain.com\n",
);

// ── Postal ────────────────────────────────────────────────────────────────────

const COMPOSE_POSTAL: &str = concat!(
    "# Postal — self-hosted SMTP server (MIT).\n",
    "# ⚠ For best email deliverability, Postal needs a dedicated IP address.\n",
    "#   On Fly.io: use a dedicated-vm machine. On Railway: use a static outbound IP add-on.\n",
    "# Full guide: https://docs.postalserver.io/install/installation\n",
    "# Usage: cp .env.postal.example .env.postal && docker compose --env-file .env.postal up -d\n",
    "services:\n",
    "  postal:\n",
    "    image: ghcr.io/postalserver/postal:latest\n",
    "    ports:\n",
    "      - \"25:25\"    # SMTP inbound\n",
    "      - \"587:587\"  # SMTP submission\n",
    "      - \"5000:5000\" # Web UI\n",
    "    environment:\n",
    "      POSTAL_DATABASE_HOST: db\n",
    "      POSTAL_DATABASE_USERNAME: postal\n",
    "      POSTAL_DATABASE_PASSWORD: \"${DB_PASSWORD:?set DB_PASSWORD in .env.postal}\"\n",
    "      POSTAL_RABBITMQ_HOST: rabbitmq\n",
    "      POSTAL_SECRET_KEY: \"${SECRET_KEY:?set SECRET_KEY in .env.postal}\"\n",
    "    depends_on:\n",
    "      db:\n",
    "        condition: service_healthy\n",
    "      rabbitmq:\n",
    "        condition: service_started\n",
    "    volumes:\n",
    "      - postal_data:/config\n",
    "    restart: unless-stopped\n",
    "\n",
    "  db:\n",
    "    image: mysql:8\n",
    "    environment:\n",
    "      MYSQL_DATABASE: postal\n",
    "      MYSQL_USER: postal\n",
    "      MYSQL_PASSWORD: \"${DB_PASSWORD}\"\n",
    "      MYSQL_ROOT_PASSWORD: \"${DB_ROOT_PASSWORD:-rootpass}\"\n",
    "    volumes:\n",
    "      - postal_db:/var/lib/mysql\n",
    "    healthcheck:\n",
    "      test: [\"CMD\", \"mysqladmin\", \"ping\", \"-h\", \"localhost\"]\n",
    "      interval: 5s\n",
    "      timeout: 5s\n",
    "      retries: 10\n",
    "    restart: unless-stopped\n",
    "\n",
    "  rabbitmq:\n",
    "    image: rabbitmq:3-management-alpine\n",
    "    volumes:\n",
    "      - postal_rabbitmq:/var/lib/rabbitmq\n",
    "    restart: unless-stopped\n",
    "\n",
    "volumes:\n",
    "  postal_data:\n",
    "  postal_db:\n",
    "  postal_rabbitmq:\n",
);
const ENV_POSTAL: &str = concat!(
    "DB_PASSWORD=change-me\n",
    "DB_ROOT_PASSWORD=change-me-root\n",
    "SECRET_KEY=change-me-long-random-string\n",
);

// ── Uptime Kuma ───────────────────────────────────────────────────────────────

const COMPOSE_UPTIME_KUMA: &str = concat!(
    "# Uptime Kuma — uptime monitoring + public status page (MIT).\n",
    "# Usage: docker compose up -d\n",
    "services:\n",
    "  uptime-kuma:\n",
    "    image: louislam/uptime-kuma:latest\n",
    "    ports:\n",
    "      - \"3001:3001\"\n",
    "    volumes:\n",
    "      - uptime_kuma_data:/app/data\n",
    "    restart: unless-stopped\n",
    "\n",
    "volumes:\n",
    "  uptime_kuma_data:\n",
);
const ENV_UPTIME_KUMA: &str = concat!(
    "# No env vars needed — configure via the web UI after first launch.\n",
);

// ── BookStack ─────────────────────────────────────────────────────────────────

const COMPOSE_BOOKSTACK: &str = concat!(
    "# BookStack — structured wiki and knowledge base (MIT).\n",
    "# Usage: cp .env.bookstack.example .env.bookstack && docker compose --env-file .env.bookstack up -d\n",
    "services:\n",
    "  bookstack:\n",
    "    image: lscr.io/linuxserver/bookstack:latest\n",
    "    ports:\n",
    "      - \"6875:80\"\n",
    "    environment:\n",
    "      APP_URL: \"${BOOKSTACK_URL:?set BOOKSTACK_URL in .env.bookstack}\"\n",
    "      DB_HOST: db\n",
    "      DB_DATABASE: bookstack\n",
    "      DB_USERNAME: bookstack\n",
    "      DB_PASSWORD: \"${DB_PASSWORD:?set DB_PASSWORD in .env.bookstack}\"\n",
    "      MAIL_DRIVER: smtp\n",
    "      MAIL_HOST: \"${SMTP_HOST}\"\n",
    "      MAIL_PORT: \"${SMTP_PORT:-587}\"\n",
    "      MAIL_USERNAME: \"${SMTP_USER}\"\n",
    "      MAIL_PASSWORD: \"${SMTP_PASSWORD}\"\n",
    "      MAIL_FROM: \"${SMTP_FROM}\"\n",
    "    volumes:\n",
    "      - bookstack_data:/config\n",
    "    depends_on:\n",
    "      db:\n",
    "        condition: service_healthy\n",
    "    restart: unless-stopped\n",
    "\n",
    "  db:\n",
    "    image: mysql:8\n",
    "    environment:\n",
    "      MYSQL_DATABASE: bookstack\n",
    "      MYSQL_USER: bookstack\n",
    "      MYSQL_PASSWORD: \"${DB_PASSWORD}\"\n",
    "      MYSQL_ROOT_PASSWORD: \"${DB_ROOT_PASSWORD:-rootpass}\"\n",
    "    volumes:\n",
    "      - bookstack_db:/var/lib/mysql\n",
    "    healthcheck:\n",
    "      test: [\"CMD\", \"mysqladmin\", \"ping\", \"-h\", \"localhost\"]\n",
    "      interval: 5s\n",
    "      timeout: 5s\n",
    "      retries: 10\n",
    "    restart: unless-stopped\n",
    "\n",
    "volumes:\n",
    "  bookstack_data:\n",
    "  bookstack_db:\n",
);
const ENV_BOOKSTACK: &str = concat!(
    "DB_PASSWORD=change-me\n",
    "DB_ROOT_PASSWORD=change-me-root\n",
    "BOOKSTACK_URL=https://docs.yourdomain.com\n",
    "SMTP_HOST=smtp-relay.brevo.com\n",
    "SMTP_PORT=587\n",
    "SMTP_USER=your-brevo-login@example.com\n",
    "SMTP_PASSWORD=your-brevo-smtp-key\n",
    "SMTP_FROM=noreply@yourdomain.com\n",
);

// ── Twenty CRM ────────────────────────────────────────────────────────────────

const COMPOSE_TWENTY: &str = concat!(
    "# Twenty — modern open-source CRM (AGPL 3.0).\n",
    "# ⚠ Requires ~4 GB RAM. Fly.io: performance-2x machine (paid). Railway Pro recommended.\n",
    "# Usage: cp .env.twenty.example .env.twenty && docker compose --env-file .env.twenty up -d\n",
    "services:\n",
    "  twenty-server:\n",
    "    image: twentycrm/twenty:latest\n",
    "    ports:\n",
    "      - \"3000:3000\"\n",
    "    environment:\n",
    "      SERVER_URL: \"${TWENTY_URL:?set TWENTY_URL in .env.twenty}\"\n",
    "      PG_DATABASE_URL: \"postgres://twenty:${DB_PASSWORD}@db:5432/twenty\"\n",
    "      REDIS_URL: \"redis://redis:6379\"\n",
    "      APP_SECRET: \"${APP_SECRET:?set APP_SECRET in .env.twenty}\"\n",
    "      STORAGE_TYPE: local\n",
    "    depends_on:\n",
    "      db:\n",
    "        condition: service_healthy\n",
    "      redis:\n",
    "        condition: service_started\n",
    "    restart: unless-stopped\n",
    "\n",
    "  twenty-worker:\n",
    "    image: twentycrm/twenty:latest\n",
    "    command: worker\n",
    "    environment:\n",
    "      PG_DATABASE_URL: \"postgres://twenty:${DB_PASSWORD}@db:5432/twenty\"\n",
    "      REDIS_URL: \"redis://redis:6379\"\n",
    "      APP_SECRET: \"${APP_SECRET}\"\n",
    "    depends_on:\n",
    "      db:\n",
    "        condition: service_healthy\n",
    "      redis:\n",
    "        condition: service_started\n",
    "    restart: unless-stopped\n",
    "\n",
    "  db:\n",
    "    image: postgres:16-alpine\n",
    "    environment:\n",
    "      POSTGRES_USER: twenty\n",
    "      POSTGRES_PASSWORD: \"${DB_PASSWORD:?set DB_PASSWORD in .env.twenty}\"\n",
    "      POSTGRES_DB: twenty\n",
    "    volumes:\n",
    "      - twenty_db:/var/lib/postgresql/data\n",
    "    healthcheck:\n",
    "      test: [\"CMD-SHELL\", \"pg_isready -U twenty\"]\n",
    "      interval: 5s\n",
    "      timeout: 5s\n",
    "      retries: 5\n",
    "    restart: unless-stopped\n",
    "\n",
    "  redis:\n",
    "    image: redis:7-alpine\n",
    "    restart: unless-stopped\n",
    "\n",
    "volumes:\n",
    "  twenty_db:\n",
);
const ENV_TWENTY: &str = concat!(
    "DB_PASSWORD=change-me\n",
    "APP_SECRET=change-me-long-random-string\n",
    "TWENTY_URL=https://crm.yourdomain.com\n",
);

// ── Authentik ─────────────────────────────────────────────────────────────────

const COMPOSE_AUTHENTIK: &str = concat!(
    "# Authentik — identity provider (MIT).\n",
    "# ⚠ Requires ~512 MB RAM. Borderline on Fly.io free; Railway free tier works.\n",
    "# Full guide: https://docs.goauthentik.io/docs/installation/docker-compose\n",
    "# Usage: cp .env.authentik.example .env.authentik && docker compose --env-file .env.authentik up -d\n",
    "services:\n",
    "  authentik-server:\n",
    "    image: ghcr.io/goauthentik/server:latest\n",
    "    command: server\n",
    "    ports:\n",
    "      - \"9000:9000\"\n",
    "      - \"9443:9443\"\n",
    "    environment:\n",
    "      AUTHENTIK_REDIS__HOST: redis\n",
    "      AUTHENTIK_POSTGRESQL__HOST: db\n",
    "      AUTHENTIK_POSTGRESQL__USER: authentik\n",
    "      AUTHENTIK_POSTGRESQL__PASSWORD: \"${DB_PASSWORD:?set DB_PASSWORD in .env.authentik}\"\n",
    "      AUTHENTIK_POSTGRESQL__NAME: authentik\n",
    "      AUTHENTIK_SECRET_KEY: \"${SECRET_KEY:?set SECRET_KEY in .env.authentik}\"\n",
    "    depends_on:\n",
    "      db:\n",
    "        condition: service_healthy\n",
    "      redis:\n",
    "        condition: service_started\n",
    "    restart: unless-stopped\n",
    "\n",
    "  authentik-worker:\n",
    "    image: ghcr.io/goauthentik/server:latest\n",
    "    command: worker\n",
    "    environment:\n",
    "      AUTHENTIK_REDIS__HOST: redis\n",
    "      AUTHENTIK_POSTGRESQL__HOST: db\n",
    "      AUTHENTIK_POSTGRESQL__USER: authentik\n",
    "      AUTHENTIK_POSTGRESQL__PASSWORD: \"${DB_PASSWORD}\"\n",
    "      AUTHENTIK_POSTGRESQL__NAME: authentik\n",
    "      AUTHENTIK_SECRET_KEY: \"${SECRET_KEY}\"\n",
    "    depends_on:\n",
    "      db:\n",
    "        condition: service_healthy\n",
    "      redis:\n",
    "        condition: service_started\n",
    "    restart: unless-stopped\n",
    "\n",
    "  db:\n",
    "    image: postgres:16-alpine\n",
    "    environment:\n",
    "      POSTGRES_USER: authentik\n",
    "      POSTGRES_PASSWORD: \"${DB_PASSWORD}\"\n",
    "      POSTGRES_DB: authentik\n",
    "    volumes:\n",
    "      - authentik_db:/var/lib/postgresql/data\n",
    "    healthcheck:\n",
    "      test: [\"CMD-SHELL\", \"pg_isready -U authentik\"]\n",
    "      interval: 5s\n",
    "      timeout: 5s\n",
    "      retries: 5\n",
    "    restart: unless-stopped\n",
    "\n",
    "  redis:\n",
    "    image: redis:7-alpine\n",
    "    restart: unless-stopped\n",
    "\n",
    "volumes:\n",
    "  authentik_db:\n",
);
const ENV_AUTHENTIK: &str = concat!(
    "DB_PASSWORD=change-me\n",
    "SECRET_KEY=change-me-long-random-string-at-least-50-chars\n",
);

// ── Zitadel ───────────────────────────────────────────────────────────────────

const COMPOSE_ZITADEL: &str = concat!(
    "# Zitadel — identity platform (Apache 2.0).\n",
    "# Free cloud tier at https://zitadel.com (recommended; generous free tier).\n",
    "# Full self-host guide: https://zitadel.com/docs/self-hosting/deploy/compose\n",
    "# Usage: cp .env.zitadel.example .env.zitadel && docker compose --env-file .env.zitadel up -d\n",
    "services:\n",
    "  zitadel:\n",
    "    image: ghcr.io/zitadel/zitadel:latest\n",
    "    ports:\n",
    "      - \"8080:8080\"\n",
    "    command: start-from-init --masterkey \"${ZITADEL_MASTERKEY:?set ZITADEL_MASTERKEY}\" --tlsMode disabled\n",
    "    environment:\n",
    "      ZITADEL_DATABASE_POSTGRES_HOST: db\n",
    "      ZITADEL_DATABASE_POSTGRES_PORT: \"5432\"\n",
    "      ZITADEL_DATABASE_POSTGRES_DATABASE: zitadel\n",
    "      ZITADEL_DATABASE_POSTGRES_USER_USERNAME: zitadel\n",
    "      ZITADEL_DATABASE_POSTGRES_USER_PASSWORD: \"${DB_PASSWORD:?set DB_PASSWORD in .env.zitadel}\"\n",
    "      ZITADEL_EXTERNALPORT: \"8080\"\n",
    "      ZITADEL_EXTERNALDOMAIN: \"${ZITADEL_DOMAIN:?set ZITADEL_DOMAIN in .env.zitadel}\"\n",
    "    depends_on:\n",
    "      db:\n",
    "        condition: service_healthy\n",
    "    restart: unless-stopped\n",
    "\n",
    "  db:\n",
    "    image: postgres:16-alpine\n",
    "    environment:\n",
    "      POSTGRES_USER: zitadel\n",
    "      POSTGRES_PASSWORD: \"${DB_PASSWORD}\"\n",
    "      POSTGRES_DB: zitadel\n",
    "    volumes:\n",
    "      - zitadel_db:/var/lib/postgresql/data\n",
    "    healthcheck:\n",
    "      test: [\"CMD-SHELL\", \"pg_isready -U zitadel\"]\n",
    "      interval: 5s\n",
    "      timeout: 5s\n",
    "      retries: 5\n",
    "    restart: unless-stopped\n",
    "\n",
    "volumes:\n",
    "  zitadel_db:\n",
);
const ENV_ZITADEL: &str = concat!(
    "DB_PASSWORD=change-me\n",
    "ZITADEL_MASTERKEY=change-me-32-char-random-string\n",
    "ZITADEL_DOMAIN=auth.yourdomain.com\n",
);

// ── Frappe LMS ────────────────────────────────────────────────────────────────

const COMPOSE_FRAPPE_LMS: &str = concat!(
    "# Frappe LMS — open-source courses and learning management (MIT).\n",
    "# Full guide: https://github.com/frappe/lms#installation\n",
    "# Usage: cp .env.frappe-lms.example .env.frappe-lms && docker compose --env-file .env.frappe-lms up -d\n",
    "services:\n",
    "  frappe-lms:\n",
    "    image: frappe/frappe-worker:latest\n",
    "    ports:\n",
    "      - \"8000:8000\"\n",
    "    environment:\n",
    "      FRAPPE_SITE_NAME_HEADER: \"${FRAPPE_SITE:?set FRAPPE_SITE in .env.frappe-lms}\"\n",
    "      REDIS_CACHE: \"redis://redis:6379/0\"\n",
    "      REDIS_QUEUE: \"redis://redis:6379/1\"\n",
    "      DB_HOST: db\n",
    "      DB_PORT: \"3306\"\n",
    "      MYSQL_ROOT_PASSWORD: \"${DB_ROOT_PASSWORD:?set DB_ROOT_PASSWORD in .env.frappe-lms}\"\n",
    "    volumes:\n",
    "      - frappe_sites:/home/frappe/frappe-bench/sites\n",
    "    depends_on:\n",
    "      db:\n",
    "        condition: service_healthy\n",
    "      redis:\n",
    "        condition: service_started\n",
    "    restart: unless-stopped\n",
    "\n",
    "  db:\n",
    "    image: mysql:8\n",
    "    environment:\n",
    "      MYSQL_ROOT_PASSWORD: \"${DB_ROOT_PASSWORD}\"\n",
    "    volumes:\n",
    "      - frappe_db:/var/lib/mysql\n",
    "    healthcheck:\n",
    "      test: [\"CMD\", \"mysqladmin\", \"ping\", \"-h\", \"localhost\", \"-uroot\", \"-p${DB_ROOT_PASSWORD}\"]\n",
    "      interval: 5s\n",
    "      timeout: 5s\n",
    "      retries: 10\n",
    "    restart: unless-stopped\n",
    "\n",
    "  redis:\n",
    "    image: redis:7-alpine\n",
    "    restart: unless-stopped\n",
    "\n",
    "volumes:\n",
    "  frappe_sites:\n",
    "  frappe_db:\n",
);
const ENV_FRAPPE_LMS: &str = concat!(
    "FRAPPE_SITE=lms.yourdomain.com\n",
    "DB_ROOT_PASSWORD=change-me\n",
);

// ── compose stubs ─────────────────────────────────────────────────────────────

/// Returns per-service `docker-compose.yml` and `.env.example` files for all
/// self-hosted services selected in `f`. Brevo and other SaaS services are
/// excluded — they need no local infrastructure.
pub(crate) fn service_compose_stubs(f: &AllFeatures) -> Vec<(&'static str, &'static str)> {
    let mut files: Vec<(&'static str, &'static str)> = Vec::new();

    if f.email == EmailChoice::Listmonk {
        files.push(("listmonk/Caddyfile",            CADDYFILE_LISTMONK));
        files.push(("listmonk/docker-compose.yml",   COMPOSE_LISTMONK));
        files.push(("listmonk/.env.listmonk.example", ENV_LISTMONK));
    }
    if f.cms == CmsChoice::Payload {
        files.push(("payload/docker-compose.yml",   COMPOSE_PAYLOAD));
        files.push(("payload/.env.payload.example", ENV_PAYLOAD));
    }
    if f.search == SearchChoice::Meilisearch {
        files.push(("meilisearch/docker-compose.yml",         COMPOSE_MEILISEARCH));
        files.push(("meilisearch/.env.meilisearch.example",   ENV_MEILISEARCH));
    }
    if f.community == CommunityChoice::Remark42 {
        files.push(("remark42/docker-compose.yml",       COMPOSE_REMARK42));
        files.push(("remark42/.env.remark42.example",    ENV_REMARK42));
    }
    if f.forum == ForumChoice::Flarum {
        files.push(("flarum/docker-compose.yml",    COMPOSE_FLARUM));
        files.push(("flarum/.env.flarum.example",   ENV_FLARUM));
    }
    if f.forum == ForumChoice::Discourse {
        files.push(("discourse/docker-compose.yml",      COMPOSE_DISCOURSE));
        files.push(("discourse/.env.discourse.example",  ENV_DISCOURSE));
    }
    if f.chat == ChatChoice::Tiledesk {
        files.push(("tiledesk/docker-compose.yml",      COMPOSE_TILEDESK));
        files.push(("tiledesk/.env.tiledesk.example",   ENV_TILEDESK));
    }
    if f.payments == PaymentChoice::HyperSwitch {
        files.push(("hyperswitch/docker-compose.yml",        COMPOSE_HYPERSWITCH));
        files.push(("hyperswitch/.env.hyperswitch.example",  ENV_HYPERSWITCH));
    }
    if f.schedule == ScheduleChoice::Rallly {
        files.push(("rallly/docker-compose.yml",   COMPOSE_RALLLY));
        files.push(("rallly/.env.rallly.example",  ENV_RALLLY));
    }
    if f.schedule == ScheduleChoice::CalCom {
        files.push(("calcom/docker-compose.yml",   COMPOSE_CALCOM));
        files.push(("calcom/.env.calcom.example",  ENV_CALCOM));
    }
    if f.notify == NotifyChoice::Gotify {
        files.push(("gotify/docker-compose.yml",   COMPOSE_GOTIFY));
        files.push(("gotify/.env.gotify.example",  ENV_GOTIFY));
    }
    if f.commerce == CommerceChoice::Medusa {
        files.push(("medusa/docker-compose.yml",   COMPOSE_MEDUSA));
        files.push(("medusa/.env.medusa.example",  ENV_MEDUSA));
    }
    if f.commerce == CommerceChoice::Vendure {
        files.push(("vendure/docker-compose.yml",   COMPOSE_VENDURE));
        files.push(("vendure/.env.vendure.example", ENV_VENDURE));
    }
    if f.forms == FormsChoice::Typebot {
        files.push(("typebot/docker-compose.yml",   COMPOSE_TYPEBOT));
        files.push(("typebot/.env.typebot.example", ENV_TYPEBOT));
    }
    if f.forms == FormsChoice::Formbricks {
        files.push(("formbricks/docker-compose.yml",        COMPOSE_FORMBRICKS));
        files.push(("formbricks/.env.formbricks.example",   ENV_FORMBRICKS));
    }
    if f.video == VideoChoice::PeerTube {
        files.push(("peertube/docker-compose.yml",       COMPOSE_PEERTUBE));
        files.push(("peertube/.env.peertube.example",    ENV_PEERTUBE));
    }
    if f.podcast == PodcastChoice::Castopod {
        files.push(("castopod/docker-compose.yml",       COMPOSE_CASTOPOD));
        files.push(("castopod/.env.castopod.example",    ENV_CASTOPOD));
    }
    if f.events == EventChoice::HiEvents {
        files.push(("hievents/docker-compose.yml",       COMPOSE_HIEVENTS));
        files.push(("hievents/.env.hievents.example",    ENV_HIEVENTS));
    }
    if f.events == EventChoice::Pretix {
        files.push(("pretix/docker-compose.yml",    COMPOSE_PRETIX));
        files.push(("pretix/.env.pretix.example",   ENV_PRETIX));
    }
    if f.transactional_email == TransactionalEmailChoice::Postal {
        files.push(("postal/docker-compose.yml",   COMPOSE_POSTAL));
        files.push(("postal/.env.postal.example",  ENV_POSTAL));
    }
    if f.status == StatusChoice::UptimeKuma {
        files.push(("uptime-kuma/docker-compose.yml",       COMPOSE_UPTIME_KUMA));
        files.push(("uptime-kuma/.env.uptime-kuma.example", ENV_UPTIME_KUMA));
    }
    if f.knowledge_base == KnowledgeBaseChoice::BookStack {
        files.push(("bookstack/docker-compose.yml",       COMPOSE_BOOKSTACK));
        files.push(("bookstack/.env.bookstack.example",   ENV_BOOKSTACK));
    }
    if f.crm == CrmChoice::Twenty {
        files.push(("twenty/docker-compose.yml",   COMPOSE_TWENTY));
        files.push(("twenty/.env.twenty.example",  ENV_TWENTY));
    }
    if f.sso == SsoChoice::Authentik {
        files.push(("authentik/docker-compose.yml",       COMPOSE_AUTHENTIK));
        files.push(("authentik/.env.authentik.example",   ENV_AUTHENTIK));
    }
    if f.sso == SsoChoice::Zitadel {
        files.push(("zitadel/docker-compose.yml",    COMPOSE_ZITADEL));
        files.push(("zitadel/.env.zitadel.example",  ENV_ZITADEL));
    }
    if f.courses == CourseChoice::FrappeLms {
        files.push(("frappe-lms/docker-compose.yml",        COMPOSE_FRAPPE_LMS));
        files.push(("frappe-lms/.env.frappe-lms.example",   ENV_FRAPPE_LMS));
    }

    files
}

// ── helpers ───────────────────────────────────────────────────────────────────

fn needs_flyio(f: &AllFeatures) -> bool {
    !service_compose_stubs(f).is_empty()
}

fn needs_r2(f: &AllFeatures) -> bool {
    f.video == VideoChoice::PeerTube || f.podcast == PodcastChoice::Castopod
}

// ── SERVICES.md builder ───────────────────────────────────────────────────────

/// Generates a unified `SERVICES.md` setup guide covering:
/// 1. Hosting accounts to set up first (Fly.io, Cloudflare R2 if needed)
/// 2. Per-service deploy steps for every selected self-hosted service
///
/// Returns `None` if no self-hosted services were selected.
pub(crate) fn build_services_doc(f: &AllFeatures) -> Option<String> {
    if service_compose_stubs(f).is_empty() {
        return None;
    }
    let mut doc = String::from(
        "# Services Setup Guide\n\
         \n\
         Generated by `astropress new`. Deploy your services in this order:\n\
         first set up your hosting accounts, then deploy each service.\n\
         \n",
    );

    // ── section 1: hosting accounts ──────────────────────────────────────
    doc.push_str("## 1. Set up hosting accounts\n\n");

    if needs_flyio(f) {
        doc.push_str(concat!(
            "### Fly.io (free tier)\n\n",
            "```sh\n",
            "# Install flyctl\n",
            "curl -L https://fly.io/install.sh | sh\n",
            "\n",
            "# Create account and log in\n",
            "fly auth signup   # or: fly auth login\n",
            "```\n\n",
            "All self-hosted services in this guide can be deployed with:\n\n",
            "```sh\n",
            "cd <service-dir>\n",
            "fly launch   # reads docker-compose.yml and creates fly.toml\n",
            "fly deploy\n",
            "```\n\n",
        ));
    }

    if needs_r2(f) {
        doc.push_str(concat!(
            "### Cloudflare R2 (free: 10 GB storage, free egress)\n\n",
            "Video and audio files can easily exceed free compute disk limits.\n",
            "Cloudflare R2 provides 10 GB free storage with zero egress fees.\n\n",
            "1. Sign up at <https://dash.cloudflare.com>\n",
            "2. Go to **R2 Object Storage** → **Create bucket**\n",
            "   - Bucket name: `your-project-media` (or similar)\n",
            "   - Region: Automatic\n",
            "3. Go to **Manage R2 API tokens** → **Create API token**\n",
            "   - Permissions: Object Read & Write\n",
            "   - Save the **Access Key ID** and **Secret Access Key**\n",
            "4. Note your **Account ID** from the R2 overview page\n\n",
            "Set these values in your service `.env` file:\n",
            "```\n",
            "R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com\n",
            "R2_ACCESS_KEY_ID=<your-access-key-id>\n",
            "R2_SECRET_ACCESS_KEY=<your-secret-access-key>\n",
            "```\n\n",
        ));
    }

    // ── section 2: per-service steps ─────────────────────────────────────
    doc.push_str("## 2. Deploy services\n\n");

    if f.email == EmailChoice::Listmonk {
        doc.push_str(concat!(
            "### Listmonk (newsletter)\n\n",
            "```sh\n",
            "cd listmonk\n",
            "cp .env.listmonk.example .env.listmonk\n",
            "# Edit .env.listmonk — set DB_PASSWORD and SITE_URL\n",
            "docker compose --env-file .env.listmonk up -d\n",
            "```\n\n",
            "**First-time setup:**\n\n",
            "1. Visit your Listmonk URL and complete the setup wizard.\n",
            "2. Go to **Lists** → **New list** and create a subscriber list.\n",
            "3. Note the list ID (shown in the URL as `/lists/1/...` → ID is `1`).\n",
            "4. Add to your `.env`:\n\n",
            "```\n",
            "NEWSLETTER_DELIVERY_MODE=listmonk\n",
            "LISTMONK_API_URL=https://your-listmonk-instance.example.com\n",
            "LISTMONK_API_USERNAME=your-admin-username\n",
            "LISTMONK_API_PASSWORD=your-admin-password\n",
            "LISTMONK_LIST_ID=1\n",
            "```\n\n",
            "**Why Caddy?** Listmonk sends `X-Frame-Options: SAMEORIGIN` on every response.\n",
            "The Caddy proxy strips that header and replaces it with a `frame-ancestors` CSP\n",
            "scoped to your Astropress site, so the Listmonk admin embeds at `/ap-admin/services/email`.\n\n",
            "**Mailchimp migration:** Export from Mailchimp → Audience → Export Audience (CSV),\n",
            "convert to `[{\"email\": \"...\", \"name\": \"...\"}]` JSON, then POST to `/api/subscribers/import`.\n\n",
        ));
    }

    if f.cms == CmsChoice::Payload {
        doc.push_str(concat!(
            "### Payload CMS\n\n",
            "```sh\n",
            "cd payload\n",
            "cp .env.payload.example .env.payload\n",
            "# Edit .env.payload — set DB_PASSWORD and PAYLOAD_SECRET\n",
            "docker compose --env-file .env.payload up -d\n",
            "```\n\n",
            "Update `.env`:\n",
            "```\n",
            "PAYLOAD_URL=https://cms.yourdomain.com\n",
            "PAYLOAD_SECRET=<your-payload-secret>\n",
            "```\n\n",
        ));
    }

    if f.search == SearchChoice::Meilisearch {
        doc.push_str(concat!(
            "### Meilisearch (full-text search)\n\n",
            "```sh\n",
            "cd meilisearch\n",
            "cp .env.meilisearch.example .env.meilisearch\n",
            "# Edit .env.meilisearch — set MEILI_MASTER_KEY\n",
            "docker compose --env-file .env.meilisearch up -d\n",
            "```\n\n",
            "Update `.env`:\n",
            "```\n",
            "MEILISEARCH_URL=https://search.yourdomain.com\n",
            "MEILISEARCH_API_KEY=<your-meili-master-key>\n",
            "```\n\n",
        ));
    }

    if f.community == CommunityChoice::Remark42 {
        doc.push_str(concat!(
            "### Remark42 (comments)\n\n",
            "```sh\n",
            "cd remark42\n",
            "cp .env.remark42.example .env.remark42\n",
            "# Edit .env.remark42 — set REMARK_URL and REMARK_SECRET\n",
            "docker compose --env-file .env.remark42 up -d\n",
            "```\n\n",
            "Update `.env`:\n",
            "```\n",
            "REMARK42_URL=https://comments.yourdomain.com\n",
            "REMARK42_SITE_ID=remark\n",
            "```\n\n",
        ));
    }

    if f.forum == ForumChoice::Flarum {
        doc.push_str(concat!(
            "### Flarum (forum)\n\n",
            "```sh\n",
            "cd flarum\n",
            "cp .env.flarum.example .env.flarum\n",
            "# Edit .env.flarum — set DB_PASSWORD and FLARUM_BASE_URL\n",
            "docker compose --env-file .env.flarum up -d\n",
            "```\n\n",
            "Update `.env`:\n",
            "```\n",
            "FLARUM_URL=https://forum.yourdomain.com\n",
            "FLARUM_API_KEY=<create in Flarum admin panel under API Keys>\n",
            "```\n\n",
        ));
    }

    if f.forum == ForumChoice::Discourse {
        doc.push_str(concat!(
            "### Discourse (forum)\n\n",
            "> ⚠ **Heavy:** Discourse needs 2 GB RAM minimum (2 CPUs recommended).\n",
            "> Fly.io `performance-2x` machine or Railway Pro are required.\n",
            "> For lighter resource use, consider Flarum instead.\n\n",
            "Discourse officially recommends its own install script:\n\n",
            "```sh\n",
            "cd discourse\n",
            "cp .env.discourse.example .env.discourse\n",
            "# See: https://github.com/discourse/discourse/blob/main/docs/INSTALL-cloud.md\n",
            "docker compose --env-file .env.discourse up -d\n",
            "```\n\n",
        ));
    }

    if f.chat == ChatChoice::Tiledesk {
        doc.push_str(concat!(
            "### Tiledesk (live chat)\n\n",
            "```sh\n",
            "cd tiledesk\n",
            "cp .env.tiledesk.example .env.tiledesk\n",
            "# Edit .env.tiledesk — set JWT_SECRET and TILEDESK_URL\n",
            "docker compose --env-file .env.tiledesk up -d\n",
            "```\n\n",
            "Full compose with all services: <https://github.com/Tiledesk/tiledesk-deployment>\n\n",
        ));
    }

    if f.payments == PaymentChoice::HyperSwitch {
        doc.push_str(concat!(
            "### HyperSwitch (payment orchestration)\n\n",
            "```sh\n",
            "cd hyperswitch\n",
            "cp .env.hyperswitch.example .env.hyperswitch\n",
            "# Edit .env.hyperswitch — set DB_PASSWORD, JWT_SECRET, HYPERSWITCH_API_KEY\n",
            "docker compose --env-file .env.hyperswitch up -d\n",
            "```\n\n",
            "After deploying, add payment connector API keys via the HyperSwitch dashboard.\n",
            "Full guide: <https://docs.hyperswitch.io/hyperswitch-open-source/deploy-hyperswitch>\n\n",
        ));
    }

    if f.schedule == ScheduleChoice::Rallly {
        doc.push_str(concat!(
            "### Rallly (scheduling polls)\n\n",
            "```sh\n",
            "cd rallly\n",
            "cp .env.rallly.example .env.rallly\n",
            "# Edit .env.rallly — set DB_PASSWORD, SECRET_PASSWORD, RALLLY_URL, and SMTP vars\n",
            "docker compose --env-file .env.rallly up -d\n",
            "```\n\n",
        ));
    }

    if f.schedule == ScheduleChoice::CalCom {
        doc.push_str(concat!(
            "### Cal.com (booking + calendar)\n\n",
            "> Free cloud tier at <https://cal.com> — recommended for most users.\n\n",
            "```sh\n",
            "cd calcom\n",
            "cp .env.calcom.example .env.calcom\n",
            "# Edit .env.calcom — set all required vars\n",
            "docker compose --env-file .env.calcom up -d\n",
            "```\n\n",
            "Full guide: <https://cal.com/docs/self-hosting/docker>\n\n",
        ));
    }

    if f.notify == NotifyChoice::Gotify {
        doc.push_str(concat!(
            "### Gotify (push notifications)\n\n",
            "```sh\n",
            "cd gotify\n",
            "cp .env.gotify.example .env.gotify\n",
            "# Edit .env.gotify — set GOTIFY_ADMIN_PASS\n",
            "docker compose --env-file .env.gotify up -d\n",
            "```\n\n",
            "After deploying, create an application in the Gotify UI to get an app token.\n",
            "Update `.env`:\n",
            "```\n",
            "GOTIFY_URL=https://notify.yourdomain.com\n",
            "GOTIFY_APP_TOKEN=<token-from-gotify-ui>\n",
            "```\n\n",
        ));
    }

    if f.commerce == CommerceChoice::Medusa {
        doc.push_str(concat!(
            "### Medusa (headless commerce)\n\n",
            "```sh\n",
            "cd medusa\n",
            "cp .env.medusa.example .env.medusa\n",
            "# Edit .env.medusa — set DB_PASSWORD, JWT_SECRET, COOKIE_SECRET\n",
            "docker compose --env-file .env.medusa up -d\n",
            "```\n\n",
        ));
    }

    if f.commerce == CommerceChoice::Vendure {
        doc.push_str(concat!(
            "### Vendure (headless commerce)\n\n",
            "```sh\n",
            "cd vendure\n",
            "cp .env.vendure.example .env.vendure\n",
            "# Edit .env.vendure — set DB_PASSWORD and SUPERADMIN_PASSWORD\n",
            "docker compose --env-file .env.vendure up -d\n",
            "```\n\n",
        ));
    }

    if f.forms == FormsChoice::Typebot {
        doc.push_str(concat!(
            "### Typebot (conversational forms)\n\n",
            "> Free cloud tier at <https://typebot.io> — recommended for most users.\n\n",
            "```sh\n",
            "cd typebot\n",
            "cp .env.typebot.example .env.typebot\n",
            "# Edit .env.typebot — set all required vars\n",
            "docker compose --env-file .env.typebot up -d\n",
            "```\n\n",
        ));
    }

    if f.forms == FormsChoice::Formbricks {
        doc.push_str(concat!(
            "### Formbricks (surveys + NPS + testimonials)\n\n",
            "> Free cloud tier at <https://formbricks.com> — recommended for most users.\n\n",
            "```sh\n",
            "cd formbricks\n",
            "cp .env.formbricks.example .env.formbricks\n",
            "# Edit .env.formbricks — set all required vars\n",
            "docker compose --env-file .env.formbricks up -d\n",
            "```\n\n",
        ));
    }

    if f.video == VideoChoice::PeerTube {
        doc.push_str(concat!(
            "### PeerTube (self-hosted video)\n\n",
            "> ⚠ Enable Cloudflare R2 object storage (set up in step 1) before deploying.\n\n",
            "```sh\n",
            "cd peertube\n",
            "cp .env.peertube.example .env.peertube\n",
            "# Edit .env.peertube — set all required vars including R2 credentials\n",
            "docker compose --env-file .env.peertube up -d\n",
            "```\n\n",
            "Full guide: <https://docs.joinpeertube.org/install/docker>\n\n",
        ));
    }

    if f.podcast == PodcastChoice::Castopod {
        doc.push_str(concat!(
            "### Castopod (podcast hosting)\n\n",
            "> ⚠ Enable Cloudflare R2 object storage (set up in step 1) before deploying.\n\n",
            "```sh\n",
            "cd castopod\n",
            "cp .env.castopod.example .env.castopod\n",
            "# Edit .env.castopod — set all required vars\n",
            "docker compose --env-file .env.castopod up -d\n",
            "```\n\n",
        ));
    }

    if f.events == EventChoice::HiEvents {
        doc.push_str(concat!(
            "### Hi.Events (event management + ticketing)\n\n",
            "```sh\n",
            "cd hievents\n",
            "cp .env.hievents.example .env.hievents\n",
            "# Edit .env.hievents — set DB_PASSWORD, APP_KEY, HIEVENTS_URL, and SMTP vars\n",
            "docker compose --env-file .env.hievents up -d\n",
            "```\n\n",
        ));
    }

    if f.events == EventChoice::Pretix {
        doc.push_str(concat!(
            "### Pretix (event ticketing)\n\n",
            "```sh\n",
            "cd pretix\n",
            "cp .env.pretix.example .env.pretix\n",
            "# Edit .env.pretix — set DB_PASSWORD, PRETIX_URL, and SMTP vars\n",
            "docker compose --env-file .env.pretix up -d\n",
            "```\n\n",
            "Full guide: <https://docs.pretix.eu/en/latest/admin/installation/docker_smallscale.html>\n\n",
        ));
    }

    if f.transactional_email == TransactionalEmailChoice::Postal {
        doc.push_str(concat!(
            "### Postal (transactional email server)\n\n",
            "> ⚠ For best deliverability, Postal needs a **dedicated IP address**.\n",
            "> On Fly.io: provision a `dedicated-vm` machine (paid).\n",
            "> On Railway: add a static outbound IP add-on.\n",
            "> Alternatively, use **Brevo** (free SaaS, 300 emails/day) with no server required.\n\n",
            "```sh\n",
            "cd postal\n",
            "cp .env.postal.example .env.postal\n",
            "# Edit .env.postal — set DB_PASSWORD and SECRET_KEY\n",
            "docker compose --env-file .env.postal up -d\n",
            "```\n\n",
            "Full guide: <https://docs.postalserver.io/install/installation>\n\n",
        ));
    }

    if f.status == StatusChoice::UptimeKuma {
        doc.push_str(concat!(
            "### Uptime Kuma (uptime monitoring + status page)\n\n",
            "```sh\n",
            "cd uptime-kuma\n",
            "docker compose up -d\n",
            "```\n\n",
            "No env configuration needed — set everything via the web UI at `http://localhost:3001`.\n\n",
        ));
    }

    if f.knowledge_base == KnowledgeBaseChoice::BookStack {
        doc.push_str(concat!(
            "### BookStack (knowledge base / wiki)\n\n",
            "```sh\n",
            "cd bookstack\n",
            "cp .env.bookstack.example .env.bookstack\n",
            "# Edit .env.bookstack — set DB_PASSWORD, BOOKSTACK_URL, and SMTP vars\n",
            "docker compose --env-file .env.bookstack up -d\n",
            "```\n\n",
            "Default login: admin@admin.com / password (change immediately after first login).\n\n",
        ));
    }

    if f.crm == CrmChoice::Twenty {
        doc.push_str(concat!(
            "### Twenty CRM\n\n",
            "> ⚠ Requires ~4 GB RAM. Use Fly.io `performance-2x` machine or Railway Pro.\n\n",
            "```sh\n",
            "cd twenty\n",
            "cp .env.twenty.example .env.twenty\n",
            "# Edit .env.twenty — set DB_PASSWORD, APP_SECRET, TWENTY_URL\n",
            "docker compose --env-file .env.twenty up -d\n",
            "```\n\n",
        ));
    }

    if f.sso == SsoChoice::Authentik {
        doc.push_str(concat!(
            "### Authentik (identity provider)\n\n",
            "> ⚠ Requires ~512 MB RAM. Railway free tier works; Fly.io free tier is borderline.\n\n",
            "```sh\n",
            "cd authentik\n",
            "cp .env.authentik.example .env.authentik\n",
            "# Edit .env.authentik — set DB_PASSWORD and SECRET_KEY\n",
            "docker compose --env-file .env.authentik up -d\n",
            "```\n\n",
            "Full guide: <https://docs.goauthentik.io/docs/installation/docker-compose>\n\n",
        ));
    }

    if f.sso == SsoChoice::Zitadel {
        doc.push_str(concat!(
            "### Zitadel (identity platform)\n\n",
            "> Free cloud tier at <https://zitadel.com> — recommended for most users.\n\n",
            "```sh\n",
            "cd zitadel\n",
            "cp .env.zitadel.example .env.zitadel\n",
            "# Edit .env.zitadel — set DB_PASSWORD, ZITADEL_MASTERKEY, ZITADEL_DOMAIN\n",
            "docker compose --env-file .env.zitadel up -d\n",
            "```\n\n",
            "Full guide: <https://zitadel.com/docs/self-hosting/deploy/compose>\n\n",
        ));
    }

    if f.courses == CourseChoice::FrappeLms {
        doc.push_str(concat!(
            "### Frappe LMS (courses)\n\n",
            "```sh\n",
            "cd frappe-lms\n",
            "cp .env.frappe-lms.example .env.frappe-lms\n",
            "# Edit .env.frappe-lms — set FRAPPE_SITE and DB_ROOT_PASSWORD\n",
            "docker compose --env-file .env.frappe-lms up -d\n",
            "```\n\n",
            "Full guide: <https://github.com/frappe/lms#installation>\n\n",
        ));
    }

    doc.push_str("---\n\n_Generated by `astropress new`_\n");
    Some(doc)
}

// ── tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::AllFeatures;

    fn with_listmonk() -> AllFeatures {
        AllFeatures { email: EmailChoice::Listmonk, ..AllFeatures::defaults() }
    }

    #[test]
    fn listmonk_generates_compose_and_caddyfile() {
        let stubs = service_compose_stubs(&with_listmonk());
        let paths: Vec<_> = stubs.iter().map(|(p, _)| *p).collect();
        assert!(paths.contains(&"listmonk/docker-compose.yml"), "{paths:?}");
        assert!(paths.contains(&"listmonk/Caddyfile"), "{paths:?}");
        assert!(paths.contains(&"listmonk/.env.listmonk.example"), "{paths:?}");
    }

    #[test]
    fn listmonk_services_doc_covers_setup() {
        let doc = build_services_doc(&with_listmonk()).expect("should generate doc");
        assert!(doc.contains("Listmonk"));
        assert!(doc.contains("LISTMONK_API_URL"));
        assert!(doc.contains("Fly.io"));
        assert!(doc.contains("docker-compose.yml") || doc.contains("docker compose"));
        assert!(doc.contains("registerAstropressService") || doc.contains("Caddy"));
    }

    #[test]
    fn no_self_hosted_services_returns_none() {
        let f = AllFeatures::defaults(); // Giscus (no compose), BuiltIn CMS
        assert!(build_services_doc(&f).is_none());
    }

    #[test]
    fn meilisearch_generates_compose() {
        let f = AllFeatures { search: SearchChoice::Meilisearch, ..AllFeatures::defaults() };
        let stubs = service_compose_stubs(&f);
        let paths: Vec<_> = stubs.iter().map(|(p, _)| *p).collect();
        assert!(paths.contains(&"meilisearch/docker-compose.yml"), "{paths:?}");
        let compose = stubs.iter().find(|(p, _)| *p == "meilisearch/docker-compose.yml").unwrap().1;
        assert!(compose.contains("MEILI_MASTER_KEY"));
    }

    #[test]
    fn meilisearch_services_doc_has_section() {
        let f = AllFeatures { search: SearchChoice::Meilisearch, ..AllFeatures::defaults() };
        let doc = build_services_doc(&f).expect("should generate doc");
        assert!(doc.contains("Meilisearch"));
        assert!(doc.contains("MEILISEARCH_URL"));
    }

    #[test]
    fn peertube_needs_r2_note_in_doc() {
        let f = AllFeatures { video: VideoChoice::PeerTube, ..AllFeatures::defaults() };
        let doc = build_services_doc(&f).expect("should generate doc");
        assert!(doc.contains("R2"), "expected Cloudflare R2 note");
        assert!(doc.contains("PeerTube"));
    }

    #[test]
    fn castopod_needs_r2_note_in_doc() {
        let f = AllFeatures { podcast: PodcastChoice::Castopod, ..AllFeatures::defaults() };
        let doc = build_services_doc(&f).expect("should generate doc");
        assert!(doc.contains("R2"), "expected Cloudflare R2 note");
    }

    #[test]
    fn postal_doc_warns_about_dedicated_ip() {
        let f = AllFeatures {
            transactional_email: TransactionalEmailChoice::Postal,
            ..AllFeatures::defaults()
        };
        let doc = build_services_doc(&f).expect("should generate doc");
        assert!(doc.contains("dedicated IP") || doc.contains("dedicated-vm"), "{}", &doc[..200]);
    }

    #[test]
    fn twenty_doc_warns_about_ram() {
        let f = AllFeatures { crm: CrmChoice::Twenty, ..AllFeatures::defaults() };
        let doc = build_services_doc(&f).expect("should generate doc");
        assert!(doc.contains("4 GB RAM") || doc.contains("4GB"), "{doc}");
    }

    #[test]
    fn brevo_does_not_generate_compose() {
        let f = AllFeatures {
            transactional_email: TransactionalEmailChoice::Brevo,
            ..AllFeatures::defaults()
        };
        let stubs = service_compose_stubs(&f);
        let paths: Vec<_> = stubs.iter().map(|(p, _)| *p).collect();
        assert!(!paths.iter().any(|p| p.contains("brevo")), "Brevo is SaaS — no compose: {paths:?}");
    }
}
