
    use super::*;
    use crate::features::{AllFeatures, TransactionalEmailChoice};

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
        let f = AllFeatures::defaults();
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
    fn typesense_generates_compose() {
        let f = AllFeatures { search: SearchChoice::Typesense, ..AllFeatures::defaults() };
        let stubs = service_compose_stubs(&f);
        let paths: Vec<_> = stubs.iter().map(|(p, _)| *p).collect();
        assert!(paths.contains(&"typesense/docker-compose.yml"), "{paths:?}");
        let compose = stubs.iter().find(|(p, _)| *p == "typesense/docker-compose.yml").unwrap().1;
        assert!(compose.contains("TYPESENSE_API_KEY"));
    }

    #[test]
    fn typesense_services_doc_has_section() {
        let f = AllFeatures { search: SearchChoice::Typesense, ..AllFeatures::defaults() };
        let doc = build_services_doc(&f).expect("should generate doc");
        assert!(doc.contains("Typesense"));
        assert!(doc.contains("TYPESENSE_API_KEY"));
    }

    #[test]
    fn chatwoot_generates_compose() {
        let f = AllFeatures { chat: ChatChoice::Chatwoot, ..AllFeatures::defaults() };
        let stubs = service_compose_stubs(&f);
        let paths: Vec<_> = stubs.iter().map(|(p, _)| *p).collect();
        assert!(paths.contains(&"chatwoot/docker-compose.yml"), "{paths:?}");
        let compose = stubs.iter().find(|(p, _)| *p == "chatwoot/docker-compose.yml").unwrap().1;
        assert!(compose.contains("SECRET_KEY_BASE"));
        assert!(compose.contains("sidekiq"));
    }

    #[test]
    fn chatwoot_services_doc_has_section() {
        let f = AllFeatures { chat: ChatChoice::Chatwoot, ..AllFeatures::defaults() };
        let doc = build_services_doc(&f).expect("should generate doc");
        assert!(doc.contains("Chatwoot"));
        assert!(doc.contains("CHATWOOT_API_TOKEN"));
    }

    #[test]
    fn flagsmith_generates_compose() {
        let f = AllFeatures { ab_testing: crate::providers::AbTestingProvider::Flagsmith, ..AllFeatures::defaults() };
        let stubs = service_compose_stubs(&f);
        let paths: Vec<_> = stubs.iter().map(|(p, _)| *p).collect();
        assert!(paths.contains(&"flagsmith/docker-compose.yml"), "{paths:?}");
        let compose = stubs.iter().find(|(p, _)| *p == "flagsmith/docker-compose.yml").unwrap().1;
        assert!(compose.contains("SECRET_KEY"));
    }

    #[test]
    fn flagsmith_services_doc_has_section() {
        let f = AllFeatures { ab_testing: crate::providers::AbTestingProvider::Flagsmith, ..AllFeatures::defaults() };
        let doc = build_services_doc(&f).expect("should generate doc");
        assert!(doc.contains("Flagsmith"));
        assert!(doc.contains("FLAGSMITH_ENVIRONMENT_KEY"));
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
    fn twenty_doc_warns_about_ram() {
        let f = AllFeatures { crm: CrmChoice::Twenty, ..AllFeatures::defaults() };
        let doc = build_services_doc(&f).expect("should generate doc");
        assert!(doc.contains("4 GB RAM") || doc.contains("4GB"), "{doc}");
    }

    #[test]
    fn hyperswitch_services_doc_covers_all_payment_regions() {
        let f = AllFeatures { payments: PaymentChoice::HyperSwitch, ..AllFeatures::defaults() };
        let doc = build_services_doc(&f).expect("should generate doc");
        // East Africa
        assert!(doc.contains("M-Pesa"),       "East Africa M-Pesa: {doc}");
        assert!(doc.contains("Daraja"),        "East Africa Daraja: {doc}");
        // West & Southern Africa
        assert!(doc.contains("Flutterwave"),   "W/S Africa Flutterwave: {doc}");
        assert!(doc.contains("Paystack"),      "W/S Africa Paystack: {doc}");
        // India
        assert!(doc.contains("Razorpay"),      "India Razorpay: {doc}");
        assert!(doc.contains("UPI"),           "India UPI: {doc}");
        // Southeast Asia
        assert!(doc.contains("Xendit"),        "SE Asia Xendit: {doc}");
        assert!(doc.contains("GrabPay"),       "SE Asia GrabPay: {doc}");
        assert!(doc.contains("PromptPay"),     "SE Asia PromptPay: {doc}");
        // Middle East & N. Africa
        assert!(doc.contains("Noon"),          "Middle East Noon: {doc}");
        assert!(doc.contains("mada"),          "Middle East mada: {doc}");
        assert!(doc.contains("KNET"),          "Middle East KNET: {doc}");
        assert!(doc.contains("Fawry"),         "Egypt Fawry: {doc}");
        // Latin America
        assert!(doc.contains("dLocal"),        "LatAm dLocal: {doc}");
        assert!(doc.contains("PIX"),           "LatAm PIX: {doc}");
        assert!(doc.contains("OXXO"),          "LatAm OXXO: {doc}");
        assert!(doc.contains("Boleto"),        "LatAm Boleto: {doc}");
    }

    #[test]
    fn postiz_generates_compose_and_env() {
        let f = AllFeatures { social: SocialChoice::Postiz, ..AllFeatures::defaults() };
        let stubs = service_compose_stubs(&f);
        let paths: Vec<_> = stubs.iter().map(|(p, _)| *p).collect();
        assert!(paths.contains(&"postiz/docker-compose.yml"), "{paths:?}");
        assert!(paths.contains(&"postiz/.env.postiz.example"), "{paths:?}");
        let compose = stubs.iter().find(|(p, _)| *p == "postiz/docker-compose.yml").unwrap().1;
        assert!(compose.contains("postiz_uploads"), "uploads volume missing: {compose}");
        let env = stubs.iter().find(|(p, _)| *p == "postiz/.env.postiz.example").unwrap().1;
        assert!(env.contains("JWT_SECRET"), "JWT_SECRET missing from env: {env}");
    }

    #[test]
    fn postiz_services_doc_has_section() {
        let f = AllFeatures { social: SocialChoice::Postiz, ..AllFeatures::defaults() };
        let doc = build_services_doc(&f).expect("should generate doc");
        assert!(doc.contains("Postiz"), "{doc}");
        assert!(doc.contains("LinkedIn"), "{doc}");
        assert!(doc.contains("Bluesky"), "{doc}");
        assert!(doc.contains("Mastodon"), "{doc}");
    }

    #[test]
    fn mixpost_generates_compose_and_env() {
        let f = AllFeatures { social: SocialChoice::Mixpost, ..AllFeatures::defaults() };
        let stubs = service_compose_stubs(&f);
        let paths: Vec<_> = stubs.iter().map(|(p, _)| *p).collect();
        assert!(paths.contains(&"mixpost/docker-compose.yml"), "{paths:?}");
        assert!(paths.contains(&"mixpost/.env.mixpost.example"), "{paths:?}");
        let compose = stubs.iter().find(|(p, _)| *p == "mixpost/docker-compose.yml").unwrap().1;
        assert!(compose.contains("APP_KEY") || compose.contains("MIXPOST"));
    }

    #[test]
    fn mixpost_services_doc_has_section() {
        let f = AllFeatures { social: SocialChoice::Mixpost, ..AllFeatures::defaults() };
        let doc = build_services_doc(&f).expect("should generate doc");
        assert!(doc.contains("Mixpost"), "{doc}");
        assert!(doc.contains("Mastodon"), "{doc}");
    }

    #[test]
    fn resend_does_not_generate_compose() {
        let f = AllFeatures {
            transactional_email: TransactionalEmailChoice::Resend,
            ..AllFeatures::defaults()
        };
        let stubs = service_compose_stubs(&f);
        let paths: Vec<_> = stubs.iter().map(|(p, _)| *p).collect();
        assert!(!paths.iter().any(|p| p.contains("resend")), "Resend is SaaS — no compose: {paths:?}");
    }

    #[test]
    fn smtp_does_not_generate_compose() {
        let f = AllFeatures {
            transactional_email: TransactionalEmailChoice::Smtp,
            ..AllFeatures::defaults()
        };
        let stubs = service_compose_stubs(&f);
        let paths: Vec<_> = stubs.iter().map(|(p, _)| *p).collect();
        assert!(!paths.iter().any(|p| p.contains("postal") || p.contains("smtp")), "SMTP should not imply a provider-specific compose stack: {paths:?}");
    }
