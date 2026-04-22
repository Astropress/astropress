use super::*;
use crate::features::{
    AllFeatures, DocsChoice, KnowledgeBaseChoice,
    SocialChoice, SsoChoice, StatusChoice,
};
use crate::providers::AppHost;

fn defaults() -> AllFeatures { AllFeatures::defaults() }

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
