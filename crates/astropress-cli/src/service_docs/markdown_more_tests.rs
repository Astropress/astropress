use super::*;
use crate::features::AllFeatures;
use crate::providers::AbTestingProvider;

#[test]
fn commerce_medusa_appended() {
    let mut f = AllFeatures::defaults();
    f.commerce = CommerceChoice::Medusa;
    let mut doc = String::new();
    append_more_services(&mut doc, &f);
    assert!(doc.contains("Medusa"));
}

#[test]
fn commerce_vendure_appended() {
    let mut f = AllFeatures::defaults();
    f.commerce = CommerceChoice::Vendure;
    let mut doc = String::new();
    append_more_services(&mut doc, &f);
    assert!(doc.contains("Vendure"));
}

#[test]
fn forms_typebot_appended() {
    let mut f = AllFeatures::defaults();
    f.forms = FormsChoice::Typebot;
    let mut doc = String::new();
    append_more_services(&mut doc, &f);
    assert!(doc.contains("Typebot"));
}

#[test]
fn forms_formbricks_appended() {
    let mut f = AllFeatures::defaults();
    f.forms = FormsChoice::Formbricks;
    let mut doc = String::new();
    append_more_services(&mut doc, &f);
    assert!(doc.contains("Formbricks"));
}

#[test]
fn video_peertube_appended() {
    let mut f = AllFeatures::defaults();
    f.video = VideoChoice::PeerTube;
    let mut doc = String::new();
    append_more_services(&mut doc, &f);
    assert!(doc.contains("PeerTube"));
}

#[test]
fn podcast_castopod_appended() {
    let mut f = AllFeatures::defaults();
    f.podcast = PodcastChoice::Castopod;
    let mut doc = String::new();
    append_more_services(&mut doc, &f);
    assert!(doc.contains("Castopod"));
}

#[test]
fn events_hievents_appended() {
    let mut f = AllFeatures::defaults();
    f.events = EventChoice::HiEvents;
    let mut doc = String::new();
    append_more_services(&mut doc, &f);
    assert!(doc.contains("Hi.Events"));
}

#[test]
fn events_pretix_appended() {
    let mut f = AllFeatures::defaults();
    f.events = EventChoice::Pretix;
    let mut doc = String::new();
    append_more_services(&mut doc, &f);
    assert!(doc.contains("Pretix"));
}

#[test]
fn status_uptime_kuma_appended() {
    let mut f = AllFeatures::defaults();
    f.status = StatusChoice::UptimeKuma;
    let mut doc = String::new();
    append_more_services(&mut doc, &f);
    assert!(doc.contains("Uptime Kuma"));
}

#[test]
fn knowledge_base_bookstack_appended() {
    let mut f = AllFeatures::defaults();
    f.knowledge_base = KnowledgeBaseChoice::BookStack;
    let mut doc = String::new();
    append_more_services(&mut doc, &f);
    assert!(doc.contains("BookStack"));
}

#[test]
fn crm_twenty_appended() {
    let mut f = AllFeatures::defaults();
    f.crm = CrmChoice::Twenty;
    let mut doc = String::new();
    append_more_services(&mut doc, &f);
    assert!(doc.contains("Twenty"));
}

#[test]
fn sso_authentik_appended() {
    let mut f = AllFeatures::defaults();
    f.sso = SsoChoice::Authentik;
    let mut doc = String::new();
    append_more_services(&mut doc, &f);
    assert!(doc.contains("Authentik"));
}

#[test]
fn sso_zitadel_appended() {
    let mut f = AllFeatures::defaults();
    f.sso = SsoChoice::Zitadel;
    let mut doc = String::new();
    append_more_services(&mut doc, &f);
    assert!(doc.contains("Zitadel"));
}

#[test]
fn courses_frappe_lms_appended() {
    let mut f = AllFeatures::defaults();
    f.courses = CourseChoice::FrappeLms;
    let mut doc = String::new();
    append_more_services(&mut doc, &f);
    assert!(doc.contains("Frappe LMS"));
}

#[test]
fn social_postiz_appended() {
    let mut f = AllFeatures::defaults();
    f.social = SocialChoice::Postiz;
    let mut doc = String::new();
    append_more_services(&mut doc, &f);
    assert!(doc.contains("Postiz"));
}

#[test]
fn social_mixpost_appended() {
    let mut f = AllFeatures::defaults();
    f.social = SocialChoice::Mixpost;
    let mut doc = String::new();
    append_more_services(&mut doc, &f);
    assert!(doc.contains("Mixpost"));
}

#[test]
fn ab_testing_flagsmith_appended() {
    let mut f = AllFeatures::defaults();
    f.ab_testing = AbTestingProvider::Flagsmith;
    let mut doc = String::new();
    append_more_services(&mut doc, &f);
    assert!(doc.contains("Flagsmith"));
}

#[test]
fn defaults_produce_empty_doc() {
    let mut f = AllFeatures::defaults();
    // defaults have commerce=None, forms=None, etc — nothing appended
    f.commerce = CommerceChoice::None;
    f.forms = FormsChoice::None;
    f.video = VideoChoice::None;
    f.podcast = PodcastChoice::None;
    f.events = EventChoice::None;
    f.status = StatusChoice::None;
    f.knowledge_base = KnowledgeBaseChoice::None;
    f.crm = CrmChoice::None;
    f.sso = SsoChoice::None;
    f.courses = CourseChoice::None;
    f.social = SocialChoice::None;
    f.ab_testing = AbTestingProvider::None;
    let mut doc = String::new();
    append_more_services(&mut doc, &f);
    assert!(doc.is_empty());
}
