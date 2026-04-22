//! Continuation of `markdown.rs`: service deploy sections for commerce,
//! forms, video, podcast, events, transactional email, status, knowledge
//! base, CRM, SSO, and courses. Split out so each file stays under the
//! 300-line arch-lint warning.

use crate::features::{
    AllFeatures, CommerceChoice, CourseChoice, CrmChoice, EventChoice, FormsChoice,
    KnowledgeBaseChoice, PodcastChoice, SocialChoice, SsoChoice, StatusChoice, VideoChoice,
};
use crate::providers::AbTestingProvider;

pub(super) fn append_more_services(doc: &mut String, f: &AllFeatures) {
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
            "### Typebot (conversational forms + testimonials + referrals)\n\n",
            "> Free cloud tier at <https://typebot.io> — recommended for most users.\n\n",
            "Webhook URL (configure in Typebot): `https://<admin-server>/ap-api/v1/testimonials/ingest`\n\n",
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
            "### Formbricks (surveys + NPS + testimonials + referrals)\n\n",
            "> Free cloud tier at <https://formbricks.com> — recommended for most users.\n\n",
            "Webhook URL (configure in Formbricks): `https://<admin-server>/ap-api/v1/testimonials/ingest`\n\n",
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
            "> ⚠ Requires ~512 MB RAM. Fly.io free tier is borderline (512 MB shared VM); Railway $5/mo works.\n\n",
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

    if f.social == SocialChoice::Postiz {
        doc.push_str(concat!(
            "### Postiz (social media cross-posting)\n\n",
            "> Platforms: LinkedIn, Bluesky, Mastodon, Twitter/X, Instagram, TikTok, Pinterest,\n",
            "> Reddit, Threads, Facebook, YouTube.\n\n",
            "```sh\n",
            "cd postiz\n",
            "cp .env.postiz.example .env.postiz\n",
            "# Edit .env.postiz — set POSTIZ_DB_PASSWORD, JWT_SECRET, MAIN_URL\n",
            "# Update DATABASE_URL to match POSTIZ_DB_PASSWORD\n",
            "docker compose --env-file .env.postiz up -d\n",
            "```\n\n",
            "Then open `http://localhost:5000`, create your account, and connect platforms at\n",
            "**Settings → Socials**.\n\n",
            "Full guide: <https://docs.postiz.com/installation/self-hosting>\n\n",
        ));
    }

    if f.social == SocialChoice::Mixpost {
        doc.push_str(concat!(
            "### Mixpost (social media scheduler)\n\n",
            "> MIT community edition. Platforms: Twitter/X, Facebook, Instagram, LinkedIn,\n",
            "> Pinterest, TikTok, Mastodon.\n",
            "> Note: Bluesky is not available in the community edition.\n\n",
            "```sh\n",
            "cd mixpost\n",
            "cp .env.mixpost.example .env.mixpost\n",
            "# Edit .env.mixpost — set MIXPOST_DB_PASSWORD, DB_PASSWORD, and APP_KEY\n",
            "docker compose --env-file .env.mixpost up -d\n",
            "```\n\n",
            "Then open `http://localhost:8080` to create your account.\n\n",
            "Full guide: <https://mixpost.app/docs/self-hosted>\n\n",
        ));
    }

    if f.ab_testing == AbTestingProvider::Flagsmith {
        doc.push_str(concat!(
            "### Flagsmith (feature flags)\n\n",
            "```sh\n",
            "cd flagsmith\n",
            "cp .env.flagsmith.example .env.flagsmith\n",
            "# Edit .env.flagsmith — set DB_PASSWORD, SECRET_KEY, FLAGSMITH_HOST\n",
            "docker compose --env-file .env.flagsmith up -d\n",
            "```\n\n",
            "Update `.env`:\n",
            "```\n",
            "FLAGSMITH_API_URL=https://flags.yourdomain.com/api/v1/\n",
            "FLAGSMITH_ENVIRONMENT_KEY=<create in Flagsmith dashboard → Environments>\n",
            "```\n\n",
            "Full guide: <https://docs.flagsmith.com/deployment/hosting/docker>\n\n",
        ));
    }
}

#[cfg(test)]
#[path = "markdown_more_tests.rs"]
mod tests;
