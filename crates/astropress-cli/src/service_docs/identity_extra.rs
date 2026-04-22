//! Extra identity/devops service constants (Flagsmith).
//! Extracted from `identity.rs` to keep that file under 300 lines.

// ── Flagsmith ─────────────────────────────────────────────────────────────────

pub(in crate::service_docs) const COMPOSE_FLAGSMITH: &str = concat!(
    "# Flagsmith — feature flags + remote config + A/B testing (BSD-3-Clause).\n",
    "# Usage: cp .env.flagsmith.example .env.flagsmith && docker compose --env-file .env.flagsmith up -d\n",
    "services:\n",
    "  flagsmith:\n",
    "    image: flagsmith/flagsmith:latest\n",
    "    ports:\n",
    "      - \"8000:8000\"\n",
    "    environment:\n",
    "      DATABASE_URL: \"postgres://flagsmith:${DB_PASSWORD}@db:5432/flagsmith\"\n",
    "      SECRET_KEY: \"${SECRET_KEY:?set SECRET_KEY in .env.flagsmith}\"\n",
    "      DJANGO_ALLOWED_HOSTS: \"${FLAGSMITH_HOST:-localhost}\"\n",
    "    depends_on:\n",
    "      db:\n",
    "        condition: service_healthy\n",
    "    restart: unless-stopped\n",
    "\n",
    "  db:\n",
    "    image: postgres:16-alpine\n",
    "    environment:\n",
    "      POSTGRES_USER: flagsmith\n",
    "      POSTGRES_PASSWORD: \"${DB_PASSWORD:?set DB_PASSWORD in .env.flagsmith}\"\n",
    "      POSTGRES_DB: flagsmith\n",
    "    volumes:\n",
    "      - flagsmith_db:/var/lib/postgresql/data\n",
    "    healthcheck:\n",
    "      test: [\"CMD-SHELL\", \"pg_isready -U flagsmith\"]\n",
    "      interval: 5s\n",
    "      timeout: 5s\n",
    "      retries: 5\n",
    "    restart: unless-stopped\n",
    "\n",
    "volumes:\n",
    "  flagsmith_db:\n",
);
pub(in crate::service_docs) const ENV_FLAGSMITH: &str = concat!(
    "DB_PASSWORD=change-me\n",
    "SECRET_KEY=change-me-long-random-string\n",
    "FLAGSMITH_HOST=flags.yourdomain.com\n",
);

