//! Continuation of CLI argument-parsing tests. Split from `parse.rs` to keep
//! both files under the 600-line arch-lint cap.

use super::*;
use commands::add::parse_add_features;

#[test]
fn parse_add_features_commerce_medusa() {
    use features::CommerceChoice;
    let args = strings(&["--commerce", "medusa"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.commerce, CommerceChoice::Medusa);
}

#[test]
fn parse_add_features_commerce_vendure() {
    use features::CommerceChoice;
    let args = strings(&["--commerce", "vendure"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.commerce, CommerceChoice::Vendure);
}

#[test]
fn parse_add_features_search_meilisearch() {
    use features::SearchChoice;
    let args = strings(&["--search", "meilisearch"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.search, SearchChoice::Meilisearch);
}

#[test]
fn parse_add_features_search_pagefind() {
    use features::SearchChoice;
    let args = strings(&["--search", "pagefind"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.search, SearchChoice::Pagefind);
}

#[test]
fn parse_add_features_forum_flarum() {
    use features::ForumChoice;
    let args = strings(&["--forum", "flarum"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.forum, ForumChoice::Flarum);
}

#[test]
fn parse_add_features_forum_discourse() {
    use features::ForumChoice;
    let args = strings(&["--forum", "discourse"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.forum, ForumChoice::Discourse);
}

#[test]
fn parse_add_features_chat_tiledesk() {
    use features::ChatChoice;
    let args = strings(&["--chat", "tiledesk"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.chat, ChatChoice::Tiledesk);
}

#[test]
fn parse_add_features_notify_ntfy() {
    use features::NotifyChoice;
    let args = strings(&["--notify", "ntfy"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.notify, NotifyChoice::Ntfy);
}

#[test]
fn parse_add_features_notify_gotify() {
    use features::NotifyChoice;
    let args = strings(&["--notify", "gotify"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.notify, NotifyChoice::Gotify);
}

#[test]
fn parse_add_features_schedule_rallly() {
    use features::ScheduleChoice;
    let args = strings(&["--schedule", "rallly"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.schedule, ScheduleChoice::Rallly);
}

#[test]
fn parse_add_features_schedule_calcom() {
    use features::ScheduleChoice;
    let args = strings(&["--schedule", "calcom"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.schedule, ScheduleChoice::CalCom);
}

#[test]
fn parse_add_features_video_peertube() {
    use features::VideoChoice;
    let args = strings(&["--video", "peertube"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.video, VideoChoice::PeerTube);
}

#[test]
fn parse_add_features_podcast_castopod() {
    use features::PodcastChoice;
    let args = strings(&["--podcast", "castopod"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.podcast, PodcastChoice::Castopod);
}

#[test]
fn parse_add_features_events_hievents() {
    use features::EventChoice;
    let args = strings(&["--events", "hievents"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.events, EventChoice::HiEvents);
}

#[test]
fn parse_add_features_events_pretix() {
    use features::EventChoice;
    let args = strings(&["--events", "pretix"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.events, EventChoice::Pretix);
}

#[test]
fn parse_add_features_sso_authentik() {
    use features::SsoChoice;
    let args = strings(&["--sso", "authentik"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.sso, SsoChoice::Authentik);
}

#[test]
fn parse_add_features_sso_zitadel() {
    use features::SsoChoice;
    let args = strings(&["--sso", "zitadel"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.sso, SsoChoice::Zitadel);
}

#[test]
fn parse_add_features_social_postiz() {
    use features::SocialChoice;
    let args = strings(&["--social", "postiz"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.social, SocialChoice::Postiz);
}

#[test]
fn parse_add_features_social_mixpost() {
    use features::SocialChoice;
    let args = strings(&["--social", "mixpost"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.social, SocialChoice::Mixpost);
}

#[test]
fn parse_add_features_cms_keystatic() {
    use features::CmsChoice;
    let args = strings(&["--cms", "keystatic"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.cms, CmsChoice::Keystatic);
}

#[test]
fn parse_add_features_cms_payload() {
    use features::CmsChoice;
    let args = strings(&["--cms", "payload"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.cms, CmsChoice::Payload);
}

#[test]
fn parse_add_features_community_giscus() {
    use features::CommunityChoice;
    let args = strings(&["--community", "giscus"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.community, CommunityChoice::Giscus);
}

#[test]
fn parse_add_features_community_remark42() {
    use features::CommunityChoice;
    let args = strings(&["--community", "remark42"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.community, CommunityChoice::Remark42);
}

#[test]
fn parse_add_features_courses_frappe_lms() {
    use features::CourseChoice;
    let args = strings(&["--courses", "frappe-lms"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.courses, CourseChoice::FrappeLms);
}

#[test]
fn parse_add_features_forms_formbricks() {
    use features::FormsChoice;
    let args = strings(&["--forms", "formbricks"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.forms, FormsChoice::Formbricks);
}

#[test]
fn parse_add_features_forms_typebot() {
    use features::FormsChoice;
    let args = strings(&["--forms", "typebot"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.forms, FormsChoice::Typebot);
}

#[test]
fn parse_add_features_transactional_email_resend() {
    use features::TransactionalEmailChoice;
    let args = strings(&["--transactional-email", "resend"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.transactional_email, TransactionalEmailChoice::Resend);
}

#[test]
fn parse_add_features_transactional_email_smtp() {
    use features::TransactionalEmailChoice;
    let args = strings(&["--transactional-email", "smtp"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.transactional_email, TransactionalEmailChoice::Smtp);
}

#[test]
fn parse_add_features_status_uptime_kuma() {
    use features::StatusChoice;
    let args = strings(&["--status", "uptime-kuma"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.status, StatusChoice::UptimeKuma);
}

#[test]
fn parse_add_features_knowledge_base_bookstack() {
    use features::KnowledgeBaseChoice;
    let args = strings(&["--knowledge-base", "bookstack"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.knowledge_base, KnowledgeBaseChoice::BookStack);
}

#[test]
fn parse_add_features_crm_twenty() {
    use features::CrmChoice;
    let args = strings(&["--crm", "twenty"]);
    let f = parse_add_features(&args).unwrap();
    assert_eq!(f.crm, CrmChoice::Twenty);
}

