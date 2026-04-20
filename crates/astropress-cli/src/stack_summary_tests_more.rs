use super::*;
use crate::features::{
    AllFeatures, ChatChoice, CommunityChoice, DocsChoice, EventChoice,
    KnowledgeBaseChoice, NotifyChoice, PodcastChoice, ScheduleChoice,
    SearchChoice, SocialChoice, SsoChoice, StatusChoice, VideoChoice,
};
use crate::providers::{AbTestingProvider, AppHost, HeatmapProvider};

fn defaults() -> AllFeatures { AllFeatures::defaults() }

#[test]
fn format_summary_search_pagefind() {
    let mut f = defaults();
    f.search = SearchChoice::Pagefind;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Pagefind"));
}

#[test]
fn format_summary_chat_tiledesk() {
    let mut f = defaults();
    f.chat = ChatChoice::Tiledesk;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Tiledesk"));
}

#[test]
fn format_summary_chat_chatwoot() {
    let mut f = defaults();
    f.chat = ChatChoice::Chatwoot;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Chatwoot"));
}

#[test]
fn format_summary_notify_ntfy() {
    let mut f = defaults();
    f.notify = NotifyChoice::Ntfy;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("ntfy"));
}

#[test]
fn format_summary_notify_gotify() {
    let mut f = defaults();
    f.notify = NotifyChoice::Gotify;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Gotify"));
}

#[test]
fn format_summary_schedule_rallly() {
    let mut f = defaults();
    f.schedule = ScheduleChoice::Rallly;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Rallly"));
}

#[test]
fn format_summary_schedule_calcom() {
    let mut f = defaults();
    f.schedule = ScheduleChoice::CalCom;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Cal.com"));
}

#[test]
fn format_summary_community_giscus() {
    let mut f = defaults();
    f.community = CommunityChoice::Giscus;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Giscus"));
}

#[test]
fn format_summary_community_remark42() {
    let mut f = defaults();
    f.community = CommunityChoice::Remark42;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Remark42"));
}

#[test]
fn format_summary_ab_testing_growthbook() {
    let mut f = defaults();
    f.ab_testing = AbTestingProvider::GrowthBook;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("GrowthBook"));
}

#[test]
fn format_summary_ab_testing_unleash() {
    let mut f = defaults();
    f.ab_testing = AbTestingProvider::Unleash;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Unleash"));
}

#[test]
fn format_summary_ab_testing_flagsmith() {
    let mut f = defaults();
    f.ab_testing = AbTestingProvider::Flagsmith;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Flagsmith"));
}

#[test]
fn format_summary_ab_testing_custom() {
    let mut f = defaults();
    f.ab_testing = AbTestingProvider::Custom;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("A/B testing   Custom"));
}

#[test]
fn format_summary_heatmap_posthog() {
    let mut f = defaults();
    f.heatmap = HeatmapProvider::PostHog;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Replays") && s.contains("PostHog"));
}

#[test]
fn format_summary_heatmap_custom() {
    let mut f = defaults();
    f.heatmap = HeatmapProvider::Custom;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Replays       Custom"));
}

#[test]
fn format_summary_video_peertube() {
    let mut f = defaults();
    f.video = VideoChoice::PeerTube;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("PeerTube"));
}

#[test]
fn format_summary_podcast_castopod() {
    let mut f = defaults();
    f.podcast = PodcastChoice::Castopod;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Castopod"));
}

#[test]
fn format_summary_events_hievents() {
    let mut f = defaults();
    f.events = EventChoice::HiEvents;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Hi.Events"));
}

#[test]
fn format_summary_events_pretix() {
    let mut f = defaults();
    f.events = EventChoice::Pretix;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Pretix"));
}

#[test]
fn format_summary_status_uptime_kuma() {
    let mut f = defaults();
    f.status = StatusChoice::UptimeKuma;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Uptime Kuma"));
}

#[test]
fn format_summary_knowledge_base_bookstack() {
    let mut f = defaults();
    f.knowledge_base = KnowledgeBaseChoice::BookStack;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("BookStack"));
}

#[test]
fn format_summary_crm_twenty() {
    let mut f = defaults();
    f.crm = crate::features::CrmChoice::Twenty;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Twenty"));
}

#[test]
fn format_summary_sso_authentik() {
    let mut f = defaults();
    f.sso = SsoChoice::Authentik;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Authentik"));
}

#[test]
fn format_summary_sso_zitadel() {
    let mut f = defaults();
    f.sso = SsoChoice::Zitadel;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Zitadel"));
}

#[test]
fn format_summary_social_postiz() {
    let mut f = defaults();
    f.social = SocialChoice::Postiz;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Postiz"));
}

#[test]
fn format_summary_social_mixpost() {
    let mut f = defaults();
    f.social = SocialChoice::Mixpost;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Mixpost"));
}

#[test]
fn format_summary_docs_starlight() {
    let mut f = defaults();
    f.docs = DocsChoice::Starlight;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Starlight"));
}

#[test]
fn format_summary_docs_vitepress() {
    let mut f = defaults();
    f.docs = DocsChoice::VitePress;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("VitePress"));
}

#[test]
fn format_summary_docs_mdbook() {
    let mut f = defaults();
    f.docs = DocsChoice::MdBook;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("mdBook"));
}

#[test]
fn format_summary_job_board() {
    let mut f = defaults();
    f.job_board = true;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("Job board"));
}

#[test]
fn format_summary_enable_api() {
    let mut f = defaults();
    f.enable_api = true;
    let s = format_stack_summary(&f, None);
    assert!(s.contains("REST API"));
}

#[test]
fn free_first_hosting_note_github_pages_none() {
    let note = free_first_hosting_note(Some(AppHost::GithubPages), None);
    // Must match the GithubPages-specific arm, not the wildcard (which also says "GitHub Pages")
    assert!(note.contains("local SQLite flow"), "expected GithubPages-specific text, got: {note}");
}

#[test]
fn free_first_hosting_note_github_pages_data_none() {
    use crate::providers::DataServices;
    let note = free_first_hosting_note(Some(AppHost::GithubPages), Some(DataServices::None));
    assert!(note.contains("local SQLite flow"), "expected GithubPages-specific text, got: {note}");
}

#[test]
fn free_first_hosting_note_cloudflare() {
    use crate::providers::DataServices;
    let note = free_first_hosting_note(Some(AppHost::CloudflarePages), Some(DataServices::Cloudflare));
    // Must match the Cloudflare-specific arm: "edge setup" vs wildcard "edge-backed sites"
    assert!(note.contains("edge setup"), "expected Cloudflare-specific text, got: {note}");
}

#[test]
fn free_first_hosting_note_vercel_supabase() {
    use crate::providers::DataServices;
    let note = free_first_hosting_note(Some(AppHost::Vercel), Some(DataServices::Supabase));
    // "Vercel + Supabase is" is arm-unique; wildcard says "Vercel/Netlify + Supabase for"
    assert!(note.contains("Vercel + Supabase is"), "expected Vercel-specific text, got: {note}");
}

#[test]
fn free_first_hosting_note_netlify_supabase() {
    use crate::providers::DataServices;
    let note = free_first_hosting_note(Some(AppHost::Netlify), Some(DataServices::Supabase));
    // "Netlify + Supabase is" is arm-unique; wildcard says "Vercel/Netlify + Supabase for"
    assert!(note.contains("Netlify + Supabase is"), "expected Netlify-specific text, got: {note}");
}

#[test]
fn free_first_hosting_note_railway() {
    let note = free_first_hosting_note(Some(AppHost::Railway), None);
    assert!(note.contains("Railway"));
}

#[test]
fn free_first_hosting_note_fallback() {
    let note = free_first_hosting_note(None, None);
    assert!(note.contains("GitHub Pages") || note.contains("Cloudflare") || note.contains("free"));
}

#[test]
fn selected_services_note_with_doc() {
    assert!(selected_services_note(true).is_some());
}

#[test]
fn selected_services_note_without_doc() {
    assert!(selected_services_note(false).is_none());
}
