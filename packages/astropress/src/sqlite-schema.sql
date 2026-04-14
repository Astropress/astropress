-- Migration bookkeeping
CREATE TABLE IF NOT EXISTS schema_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  rollback_sql TEXT
);

-- Admin users
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'editor')),
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Admin sessions (opaque token-based, server-side revocable)
CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  csrf_token TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_active_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT,
  ip_address TEXT,
  user_agent TEXT,
  FOREIGN KEY(user_id) REFERENCES admin_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_user_id ON admin_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_revoked_at ON admin_sessions(revoked_at);

-- Audit trail (immutable log)
CREATE TABLE IF NOT EXISTS audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  summary TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_user_email ON audit_events(user_email);

-- Content overrides (editorial changes to seed data)
CREATE TABLE IF NOT EXISTS content_overrides (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft', 'review', 'published', 'archived')),
  scheduled_at TEXT,
  body TEXT,
  seo_title TEXT,
  meta_description TEXT,
  excerpt TEXT,
  og_title TEXT,
  og_description TEXT,
  og_image TEXT,
  canonical_url_override TEXT,
  robots_directive TEXT,
  metadata TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_content_overrides_updated_at ON content_overrides(updated_at DESC);

-- Pessimistic edit locks for content records
CREATE TABLE IF NOT EXISTS content_locks (
  slug TEXT PRIMARY KEY,
  locked_by_email TEXT NOT NULL,
  locked_by_name TEXT NOT NULL,
  lock_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  acquired_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_content_locks_expires_at ON content_locks(expires_at);

-- User-created content records (blog posts and any non-imported rich content)
CREATE TABLE IF NOT EXISTS content_entries (
  slug TEXT PRIMARY KEY,
  legacy_url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('page', 'post')),
  template_key TEXT NOT NULL DEFAULT 'content',
  source_html_path TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  body TEXT,
  summary TEXT,
  seo_title TEXT,
  meta_description TEXT,
  og_title TEXT,
  og_description TEXT,
  og_image TEXT
);

CREATE INDEX IF NOT EXISTS idx_content_entries_kind ON content_entries(kind);
CREATE INDEX IF NOT EXISTS idx_content_entries_legacy_url ON content_entries(legacy_url);

-- Content revisions (audit trail for content)
CREATE TABLE IF NOT EXISTS content_revisions (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('imported', 'reviewed')),
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft', 'review', 'published', 'archived')),
  scheduled_at TEXT,
  body TEXT,
  seo_title TEXT,
  meta_description TEXT,
  excerpt TEXT,
  og_title TEXT,
  og_description TEXT,
  og_image TEXT,
  author_ids TEXT,
  category_ids TEXT,
  tag_ids TEXT,
  canonical_url_override TEXT,
  robots_directive TEXT,
  revision_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  FOREIGN KEY(slug) REFERENCES content_overrides(slug) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_content_revisions_slug ON content_revisions(slug);
CREATE INDEX IF NOT EXISTS idx_content_revisions_created_at ON content_revisions(created_at DESC);

CREATE TABLE IF NOT EXISTS authors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  bio TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_authors_deleted_at ON authors(deleted_at);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_categories_deleted_at ON categories(deleted_at);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_tags_deleted_at ON tags(deleted_at);

CREATE TABLE IF NOT EXISTS content_authors (
  slug TEXT NOT NULL,
  author_id INTEGER NOT NULL,
  PRIMARY KEY (slug, author_id),
  FOREIGN KEY(author_id) REFERENCES authors(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS content_categories (
  slug TEXT NOT NULL,
  category_id INTEGER NOT NULL,
  PRIMARY KEY (slug, category_id),
  FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS content_tags (
  slug TEXT NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (slug, tag_id),
  FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Redirect rules
CREATE TABLE IF NOT EXISTS redirect_rules (
  source_path TEXT PRIMARY KEY,
  target_path TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 301 CHECK(status_code IN (301, 302)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_redirect_rules_source_path ON redirect_rules(source_path);
CREATE INDEX IF NOT EXISTS idx_redirect_rules_deleted_at ON redirect_rules(deleted_at);

-- Comments (with audit trail for moderation)
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  author TEXT NOT NULL,
  email TEXT,
  body TEXT,
  route TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  policy TEXT NOT NULL DEFAULT 'disabled' CHECK(policy IN ('disabled', 'legacy-readonly', 'open-moderated')),
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comments_route ON comments(route);
CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status);
CREATE INDEX IF NOT EXISTS idx_comments_submitted_at ON comments(submitted_at DESC);

-- Media assets
CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  source_url TEXT,
  local_path TEXT NOT NULL,
  r2_key TEXT,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  thumbnail_url TEXT,
  srcset TEXT,
  file_size INTEGER,
  alt_text TEXT,
  title TEXT,
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  uploaded_by TEXT,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_media_assets_deleted_at ON media_assets(deleted_at);

CREATE TABLE IF NOT EXISTS translation_overrides (
  route TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  site_title TEXT NOT NULL,
  site_tagline TEXT NOT NULL,
  donation_url TEXT NOT NULL,
  newsletter_enabled INTEGER NOT NULL DEFAULT 0,
  comments_default_policy TEXT NOT NULL CHECK(comments_default_policy IN ('disabled', 'legacy-readonly', 'open-moderated')),
  admin_slug TEXT NOT NULL DEFAULT 'ap-admin',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cms_route_groups (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('page', 'post', 'archive', 'redirect', 'system')),
  render_strategy TEXT NOT NULL CHECK(render_strategy IN ('rich_content', 'structured_sections', 'archive_listing', 'generated_text', 'generated_xml')),
  canonical_locale TEXT NOT NULL,
  canonical_path TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cms_route_variants (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  locale TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('draft', 'review', 'published', 'archived')),
  title TEXT NOT NULL,
  summary TEXT,
  body_html TEXT,
  sections_json TEXT,
  settings_json TEXT,
  seo_title TEXT,
  meta_description TEXT,
  og_title TEXT,
  og_description TEXT,
  og_image TEXT,
  canonical_url_override TEXT,
  robots_directive TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT NOT NULL,
  FOREIGN KEY(group_id) REFERENCES cms_route_groups(id) ON DELETE CASCADE,
  UNIQUE(group_id, locale)
);

CREATE INDEX IF NOT EXISTS idx_cms_route_variants_group_id ON cms_route_variants(group_id);
CREATE INDEX IF NOT EXISTS idx_cms_route_variants_path ON cms_route_variants(path);

CREATE TABLE IF NOT EXISTS cms_route_aliases (
  path TEXT PRIMARY KEY,
  target_variant_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK(mode IN ('serve', 'redirect')),
  status_code INTEGER CHECK(status_code IN (301, 302)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(target_variant_id) REFERENCES cms_route_variants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cms_route_revisions (
  id TEXT PRIMARY KEY,
  variant_id TEXT NOT NULL,
  route_path TEXT NOT NULL,
  locale TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  revision_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT NOT NULL,
  FOREIGN KEY(variant_id) REFERENCES cms_route_variants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cms_route_revisions_variant_id ON cms_route_revisions(variant_id);
CREATE INDEX IF NOT EXISTS idx_cms_route_revisions_created_at ON cms_route_revisions(created_at DESC);

CREATE TABLE IF NOT EXISTS contact_submissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS testimonial_submissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  role TEXT,
  before_state TEXT,
  transformation TEXT,
  specific_result TEXT,
  consent_to_publish INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  source TEXT NOT NULL DEFAULT 'formbricks',
  submitted_at TEXT NOT NULL,
  approved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_testimonial_status ON testimonial_submissions(status);
CREATE INDEX IF NOT EXISTS idx_testimonial_submitted ON testimonial_submissions(submitted_at DESC);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_start_ms INTEGER NOT NULL,
  window_ms INTEGER NOT NULL
);

-- API access tokens (hashed at rest; raw token shown once on creation)
CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  scopes TEXT NOT NULL DEFAULT 'content:read',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT,
  last_used_at TEXT,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_api_tokens_token_hash ON api_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_api_tokens_revoked_at ON api_tokens(revoked_at);

-- Webhooks (ML-DSA verification key shown once on creation; private key stored server-side)
CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  events TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_fired_at TEXT,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_webhooks_deleted_at ON webhooks(deleted_at);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  requested_by TEXT,
  FOREIGN KEY(user_id) REFERENCES admin_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

CREATE TABLE IF NOT EXISTS user_invites (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  invited_by TEXT,
  FOREIGN KEY(user_id) REFERENCES admin_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_invites_user_id ON user_invites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_invites_expires_at ON user_invites(expires_at);
