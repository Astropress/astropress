use super::*;
use crate::features::{
    AllFeatures, ChatChoice, CommunityChoice, EventChoice,
    NotifyChoice, PodcastChoice, ScheduleChoice,
    SearchChoice, VideoChoice,
};
use crate::providers::{AbTestingProvider, HeatmapProvider};

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

