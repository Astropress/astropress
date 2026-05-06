//! CLI argument parser for `astropress add` — parses `--feature value` pairs
//! into an `AllFeatures` struct. Extracted from `add.rs` to keep per-file LOC
//! under the 300-line arch-lint warning.

use crate::features::{
    AllFeatures, ChatChoice, CmsChoice, CommerceChoice, CommunityChoice, CourseChoice, CrmChoice,
    DocsChoice, EmailChoice, EventChoice, FormsChoice, ForumChoice, KnowledgeBaseChoice,
    NotifyChoice, PaymentChoice, PodcastChoice, ScheduleChoice, SearchChoice, SocialChoice,
    SsoChoice, StatusChoice, TransactionalEmailChoice, VideoChoice,
};
use crate::error::CliResult;
use crate::providers::{AbTestingProvider, AnalyticsProvider, HeatmapProvider};

/// Parse `--feature value` pairs from add command args.
/// Starts from a blank `AllFeatures` (everything None/default-false) so that
/// only the flags actually passed produce output.
pub(crate) fn parse_add_features(args: &[String]) -> CliResult<AllFeatures> {
    let mut f = AllFeatures::defaults();
    // Reset community to None so we don't accidentally include Giscus env stubs
    // when the user hasn't asked for comments.
    f.community = CommunityChoice::None;

    let mut index = 0;
    while index < args.len() {
        let flag = &args[index];
        let value = args
            .get(index + 1)
            .ok_or_else(|| format!("Missing value after `{flag}`."))?;

        match flag.as_str() {
            "--analytics" => {
                f.analytics = AnalyticsProvider::parse(value).map_err(|_| {
                    format!(
                        "Unknown analytics provider `{value}`. Use: umami, plausible, matomo, posthog, custom."
                    )
                })?;
            }
            "--email" => {
                f.email = match value.as_str() {
                    "listmonk" => EmailChoice::Listmonk,
                    other => return Err(format!(
                        "Unknown email provider `{other}`. Use: listmonk."
                    ).into()),
                };
            }
            "--commerce" => {
                f.commerce = match value.as_str() {
                    "medusa"   => CommerceChoice::Medusa,
                    "vendure"  => CommerceChoice::Vendure,
                    other => return Err(format!(
                        "Unknown commerce platform `{other}`. Use: medusa, vendure."
                    ).into()),
                };
            }
            "--community" | "--comments" => {
                f.community = match value.as_str() {
                    "giscus"   => CommunityChoice::Giscus,
                    "remark42" => CommunityChoice::Remark42,
                    other => return Err(format!(
                        "Unknown comments provider `{other}`. Use: giscus, remark42."
                    ).into()),
                };
            }
            "--search" => {
                f.search = match value.as_str() {
                    "pagefind"    => SearchChoice::Pagefind,
                    "meilisearch" => SearchChoice::Meilisearch,
                    other => return Err(format!(
                        "Unknown search provider `{other}`. Use: pagefind, meilisearch."
                    ).into()),
                };
            }
            "--courses" => {
                f.courses = match value.as_str() {
                    "frappe-lms" | "frapplms" => CourseChoice::FrappeLms,
                    other => return Err(format!(
                        "Unknown LMS `{other}`. Use: frappe-lms."
                    ).into()),
                };
            }
            "--forms" | "--testimonials" => {
                f.forms = match value.as_str() {
                    "formbricks" => FormsChoice::Formbricks,
                    "typebot"    => FormsChoice::Typebot,
                    other => return Err(format!(
                        "Unknown forms provider `{other}`. Use: formbricks, typebot."
                    ).into()),
                };
            }
            "--video" => {
                f.video = match value.as_str() {
                    "peertube" => VideoChoice::PeerTube,
                    other => return Err(format!(
                        "Unknown video provider `{other}`. Use: peertube."
                    ).into()),
                };
            }
            "--podcast" => {
                f.podcast = match value.as_str() {
                    "castopod" => PodcastChoice::Castopod,
                    other => return Err(format!(
                        "Unknown podcast provider `{other}`. Use: castopod."
                    ).into()),
                };
            }
            "--events" => {
                f.events = match value.as_str() {
                    "hievents"  => EventChoice::HiEvents,
                    "pretix"    => EventChoice::Pretix,
                    other => return Err(format!(
                        "Unknown events platform `{other}`. Use: hievents, pretix."
                    ).into()),
                };
            }
            "--transactional-email" | "--transactional_email" => {
                f.transactional_email = match value.as_str() {
                    "resend" => TransactionalEmailChoice::Resend,
                    "smtp" => TransactionalEmailChoice::Smtp,
                    other => return Err(format!(
                        "Unknown transactional email provider `{other}`. Use: resend, smtp."
                    ).into()),
                };
            }
            "--status" => {
                f.status = match value.as_str() {
                    "uptime-kuma" | "uptimekuma" => StatusChoice::UptimeKuma,
                    other => return Err(format!(
                        "Unknown status provider `{other}`. Use: uptime-kuma."
                    ).into()),
                };
            }
            "--knowledge-base" | "--knowledge_base" => {
                f.knowledge_base = match value.as_str() {
                    "bookstack" => KnowledgeBaseChoice::BookStack,
                    other => return Err(format!(
                        "Unknown knowledge base `{other}`. Use: bookstack."
                    ).into()),
                };
            }
            "--crm" => {
                f.crm = match value.as_str() {
                    "twenty" => CrmChoice::Twenty,
                    other => return Err(format!(
                        "Unknown CRM `{other}`. Use: twenty."
                    ).into()),
                };
            }
            "--sso" => {
                f.sso = match value.as_str() {
                    "authentik" => SsoChoice::Authentik,
                    "zitadel"   => SsoChoice::Zitadel,
                    other => return Err(format!(
                        "Unknown SSO provider `{other}`. Use: authentik, zitadel."
                    ).into()),
                };
            }
            "--social" => {
                f.social = match value.as_str() {
                    "postiz"  => SocialChoice::Postiz,
                    "mixpost" => SocialChoice::Mixpost,
                    other => return Err(format!(
                        "Unknown social cross-posting tool `{other}`. Use: postiz, mixpost."
                    ).into()),
                };
            }
            "--forum" => {
                f.forum = match value.as_str() {
                    "flarum"    => ForumChoice::Flarum,
                    "discourse" => ForumChoice::Discourse,
                    other => return Err(format!(
                        "Unknown forum software `{other}`. Use: flarum, discourse."
                    ).into()),
                };
            }
            "--chat" => {
                f.chat = match value.as_str() {
                    "tiledesk" => ChatChoice::Tiledesk,
                    other => return Err(format!(
                        "Unknown chat provider `{other}`. Use: tiledesk."
                    ).into()),
                };
            }
            "--payments" => {
                f.payments = match value.as_str() {
                    "hyperswitch" => PaymentChoice::HyperSwitch,
                    other => return Err(format!(
                        "Unknown payment router `{other}`. Use: hyperswitch."
                    ).into()),
                };
            }
            "--notify" | "--notifications" => {
                f.notify = match value.as_str() {
                    "ntfy"   => NotifyChoice::Ntfy,
                    "gotify" => NotifyChoice::Gotify,
                    other => return Err(format!(
                        "Unknown notifications provider `{other}`. Use: ntfy, gotify."
                    ).into()),
                };
            }
            "--schedule" => {
                f.schedule = match value.as_str() {
                    "rallly"           => ScheduleChoice::Rallly,
                    "calcom" | "cal.com" => ScheduleChoice::CalCom,
                    other => return Err(format!(
                        "Unknown scheduling provider `{other}`. Use: rallly, calcom."
                    ).into()),
                };
            }
            "--cms" => {
                f.cms = match value.as_str() {
                    "keystatic" => CmsChoice::Keystatic,
                    "payload"   => CmsChoice::Payload,
                    other => return Err(format!(
                        "Unknown CMS `{other}`. Use: keystatic, payload."
                    ).into()),
                };
            }
            "--docs" => {
                f.docs = match value.as_str() {
                    "starlight"          => DocsChoice::Starlight,
                    "vitepress"          => DocsChoice::VitePress,
                    "mdbook" | "md-book" => DocsChoice::MdBook,
                    other => return Err(format!(
                        "Unknown docs generator `{other}`. Use: starlight, vitepress, mdbook."
                    ).into()),
                };
            }
            "--heatmap" | "--session-replay" => {
                f.heatmap = HeatmapProvider::parse(value).map_err(|_| {
                    format!("Unknown heatmap provider `{value}`. Use: posthog, custom.")
                })?;
            }
            "--ab-testing" | "--ab_testing" => {
                f.ab_testing = AbTestingProvider::parse(value).map_err(|_| {
                    format!(
                        "Unknown A/B testing provider `{value}`. Use: growthbook, unleash, custom."
                    )
                })?;
            }
            "--polar" => {
                f.donations.polar = matches!(value.as_str(), "true" | "1" | "yes");
            }
            "--give-lively" => {
                f.donations.give_lively = matches!(value.as_str(), "true" | "1" | "yes");
            }
            "--liberapay" => {
                f.donations.liberapay = matches!(value.as_str(), "true" | "1" | "yes");
            }
            "--pledge-crypto" => {
                f.donations.pledge_crypto = matches!(value.as_str(), "true" | "1" | "yes");
            }
            other => {
                return Err(format!(
                    "Unknown flag `{other}`. Run `astropress add --help` for available options."
                ).into())
            }
        }
        index += 2; // ~ skip
    }

    Ok(f)
}
