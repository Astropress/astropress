//! Mid-section service doc generators (Remark42 through Gotify).
//! Extracted from `markdown.rs` to keep that file under the 300-line limit.

use crate::features::{
    AllFeatures, ChatChoice, CommunityChoice, ForumChoice, NotifyChoice,
    PaymentChoice, ScheduleChoice,
};

pub(super) fn append_mid_services(doc: &mut String, f: &AllFeatures) {
    if f.community == CommunityChoice::Remark42 {
        doc.push_str(concat!(
            "### Remark42 (comments)\n\n",
            "```sh\n",
            "cd remark42\n",
            "cp .env.remark42.example .env.remark42\n",
            "# Edit .env.remark42 — set REMARK_URL and REMARK_SECRET\n",
            "docker compose --env-file .env.remark42 up -d\n",
            "```\n\n",
            "Update `.env`:\n",
            "```\n",
            "REMARK42_URL=https://comments.yourdomain.com\n",
            "REMARK42_SITE_ID=remark\n",
            "```\n\n",
        ));
    }

    if f.forum == ForumChoice::Flarum {
        doc.push_str(concat!(
            "### Flarum (forum)\n\n",
            "```sh\n",
            "cd flarum\n",
            "cp .env.flarum.example .env.flarum\n",
            "# Edit .env.flarum — set DB_PASSWORD and FLARUM_BASE_URL\n",
            "docker compose --env-file .env.flarum up -d\n",
            "```\n\n",
            "Update `.env`:\n",
            "```\n",
            "FLARUM_URL=https://forum.yourdomain.com\n",
            "FLARUM_API_KEY=<create in Flarum admin panel under API Keys>\n",
            "```\n\n",
        ));
    }

    if f.forum == ForumChoice::Discourse {
        doc.push_str(concat!(
            "### Discourse (forum)\n\n",
            "> ⚠ **Heavy:** Discourse needs 2 GB RAM minimum (2 CPUs recommended).\n",
            "> Fly.io `performance-2x` machine or Railway Pro are required.\n",
            "> For lighter resource use, consider Flarum instead.\n\n",
            "Discourse officially recommends its own install script:\n\n",
            "```sh\n",
            "cd discourse\n",
            "cp .env.discourse.example .env.discourse\n",
            "# See: https://github.com/discourse/discourse/blob/main/docs/INSTALL-cloud.md\n",
            "docker compose --env-file .env.discourse up -d\n",
            "```\n\n",
        ));
    }

    if f.chat == ChatChoice::Tiledesk {
        doc.push_str(concat!(
            "### Tiledesk (live chat)\n\n",
            "```sh\n",
            "cd tiledesk\n",
            "cp .env.tiledesk.example .env.tiledesk\n",
            "# Edit .env.tiledesk — set JWT_SECRET and TILEDESK_URL\n",
            "docker compose --env-file .env.tiledesk up -d\n",
            "```\n\n",
            "Full compose with all services: <https://github.com/Tiledesk/tiledesk-deployment>\n\n",
        ));
    }

    if f.chat == ChatChoice::Chatwoot {
        doc.push_str(concat!(
            "### Chatwoot (customer support)\n\n",
            "```sh\n",
            "cd chatwoot\n",
            "cp .env.chatwoot.example .env.chatwoot\n",
            "# Edit .env.chatwoot — set DB_PASSWORD, SECRET_KEY_BASE, CHATWOOT_URL\n",
            "docker compose --env-file .env.chatwoot up -d\n",
            "# Run database migrations on first deploy:\n",
            "docker compose exec chatwoot-server bundle exec rails db:chatwoot_prepare\n",
            "```\n\n",
            "Update `.env`:\n",
            "```\n",
            "CHATWOOT_API_URL=https://support.yourdomain.com\n",
            "CHATWOOT_API_TOKEN=<create in Settings → Integrations → API Access Token>\n",
            "CHATWOOT_WEBSITE_TOKEN=<create in Settings → Inboxes → New Inbox → Website>\n",
            "```\n\n",
        ));
    }

    if f.payments == PaymentChoice::HyperSwitch {
        doc.push_str(concat!(
            "### HyperSwitch (payment router + Unified Checkout Web SDK)\n\n",
            "> Apache 2.0 | Rust server • MIT Web SDK — made by Juspay (India)\n\n",
            "```sh\n",
            "cd hyperswitch\n",
            "cp .env.hyperswitch.example .env.hyperswitch\n",
            "# Edit .env.hyperswitch — set DB_PASSWORD, JWT_SECRET, HYPERSWITCH_API_KEY, HYPERSWITCH_BASE_URL\n",
            "docker compose --env-file .env.hyperswitch up -d\n",
            "```\n\n",
            "**Connect payment providers** — open the HyperSwitch dashboard → **Connectors** and add the\n",
            "providers for your target markets. Enter API credentials from each provider's dashboard.\n\n",
            "| Region | Provider | Methods |\n",
            "|--------|----------|---------|\n",
            "| East Africa | Safaricom M-Pesa / Daraja | STK Push (phone → PIN on device), C2B, B2C |\n",
            "| West & Southern Africa | Flutterwave (NG, GH, ZA, TZ, UG + 20 more) | Mobile money (MTN, Airtel), USSD, bank transfer, cards |\n",
            "| West & Southern Africa | Paystack (NG, GH, KE, ZA) | Cards, bank transfer, USSD, mobile money |\n",
            "| India | Razorpay | UPI, IMPS, NEFT, cards, netbanking |\n",
            "| India | Cashfree | UPI, UPI QR, cards, wallets |\n",
            "| India | PayU | UPI, EMI, cards, wallets |\n",
            "| India | PhonePe | UPI via PhonePe switch |\n",
            "| Southeast Asia | Xendit (PH, ID) | GCash, Maya (PH) · OVO, GoPay, QRIS, bank VA (ID) |\n",
            "| Southeast Asia | Adyen (SG, MY, TH, VN, PH, ID) | GrabPay, PayNow (SG), PromptPay (TH), FPX/DuitNow (MY), QRIS (ID) |\n",
            "| Middle East & N. Africa | Noon (AE, SA, EG, JO) | Cards, mada (SA), Meeza (EG) |\n",
            "| Middle East & N. Africa | Checkout.com (AE, SA, KW, QA, BH, EG) | mada (SA), KNET (KW), BENEFIT (BH), Fawry (EG), cards |\n",
            "| Latin America | dLocal (BR, MX, AR, CL, CO, PE + 9 more) | PIX (BR), OXXO (MX), Boleto (BR), PSE (CO), bank transfer, cards |\n",
            "| Latin America | Ebanx (BR, MX, CO, AR, CL, PE) | PIX (BR), Boleto (BR), OXXO (MX), cards |\n",
            "| Latin America | PayU (BR, CO, PE) | PIX (BR), PSE (CO), Efecty (CO), cards |\n",
            "| Global | Stripe | Cards, Apple Pay, Google Pay |\n",
            "| Global | Adyen | Cards + all regional methods above |\n",
            "| Global | PayPal | PayPal, Venmo |\n",
            "| Global | Checkout.com | Cards, Apple Pay, digital wallets |\n\n",
            "**Add the publishable key** — go to **Developers → API Keys**, copy the publishable key\n",
            "and add it to `.env`:\n\n",
            "```\n",
            "HYPERSWITCH_PUBLISHABLE_KEY=<your-publishable-key>\n",
            "```\n\n",
            "**Checkout form** — `src/components/HyperCheckout.astro` is already scaffolded.\n",
            "It mounts the HyperSwitch Unified Checkout Web SDK (MIT), which auto-shows the right\n",
            "UI based on the connectors you've enabled and the user's device:\n\n",
            "- **M-Pesa**: phone-number field → Safaricom STK Push — PIN prompt on device, no redirect\n",
            "- **Mobile money (Flutterwave/Paystack)**: phone number or account selection flow\n",
            "- **UPI**: VPA (UPI ID) field + collect flow — Razorpay, Cashfree, PayU, PhonePe\n",
            "- **GrabPay / PromptPay / PIX / OXXO**: redirect or in-page QR based on provider\n",
            "- **Cards / Apple Pay / Google Pay**: standard card form or native payment sheet\n\n",
            "Full deploy guide: <https://docs.hyperswitch.io/hyperswitch-open-source/deploy-hyperswitch>\n\n",
        ));
    }

    if f.schedule == ScheduleChoice::Rallly {
        doc.push_str(concat!(
            "### Rallly (scheduling polls)\n\n",
            "```sh\n",
            "cd rallly\n",
            "cp .env.rallly.example .env.rallly\n",
            "# Edit .env.rallly — set DB_PASSWORD, SECRET_PASSWORD, RALLLY_URL, and SMTP vars\n",
            "docker compose --env-file .env.rallly up -d\n",
            "```\n\n",
        ));
    }

    if f.schedule == ScheduleChoice::CalCom {
        doc.push_str(concat!(
            "### Cal.com (booking + calendar)\n\n",
            "> Free cloud tier at <https://cal.com> — recommended for most users.\n\n",
            "```sh\n",
            "cd calcom\n",
            "cp .env.calcom.example .env.calcom\n",
            "# Edit .env.calcom — set all required vars\n",
            "docker compose --env-file .env.calcom up -d\n",
            "```\n\n",
            "Full guide: <https://cal.com/docs/self-hosting/docker>\n\n",
        ));
    }

    if f.notify == NotifyChoice::Gotify {
        doc.push_str(concat!(
            "### Gotify (push notifications)\n\n",
            "```sh\n",
            "cd gotify\n",
            "cp .env.gotify.example .env.gotify\n",
            "# Edit .env.gotify — set GOTIFY_ADMIN_PASS\n",
            "docker compose --env-file .env.gotify up -d\n",
            "```\n\n",
            "After deploying, create an application in the Gotify UI to get an app token.\n",
            "Update `.env`:\n",
            "```\n",
            "GOTIFY_URL=https://notify.yourdomain.com\n",
            "GOTIFY_APP_TOKEN=<token-from-gotify-ui>\n",
            "```\n\n",
        ));
    }

}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::AllFeatures;

    #[test]
    fn community_remark42_appended() {
        let mut f = AllFeatures::defaults();
        f.community = CommunityChoice::Remark42;
        let mut doc = String::new();
        append_mid_services(&mut doc, &f);
        assert!(doc.contains("Remark42"));
    }

    #[test]
    fn forum_flarum_appended() {
        let mut f = AllFeatures::defaults();
        f.forum = ForumChoice::Flarum;
        let mut doc = String::new();
        append_mid_services(&mut doc, &f);
        assert!(doc.contains("Flarum"));
    }

    #[test]
    fn forum_discourse_appended() {
        let mut f = AllFeatures::defaults();
        f.forum = ForumChoice::Discourse;
        let mut doc = String::new();
        append_mid_services(&mut doc, &f);
        assert!(doc.contains("Discourse"));
    }

    #[test]
    fn chat_tiledesk_appended() {
        let mut f = AllFeatures::defaults();
        f.chat = ChatChoice::Tiledesk;
        let mut doc = String::new();
        append_mid_services(&mut doc, &f);
        assert!(doc.contains("Tiledesk"));
    }

    #[test]
    fn chat_chatwoot_appended() {
        let mut f = AllFeatures::defaults();
        f.chat = ChatChoice::Chatwoot;
        let mut doc = String::new();
        append_mid_services(&mut doc, &f);
        assert!(doc.contains("Chatwoot"));
    }

    #[test]
    fn payments_hyperswitch_appended() {
        let mut f = AllFeatures::defaults();
        f.payments = PaymentChoice::HyperSwitch;
        let mut doc = String::new();
        append_mid_services(&mut doc, &f);
        assert!(doc.contains("HyperSwitch"));
    }

    #[test]
    fn schedule_rallly_appended() {
        let mut f = AllFeatures::defaults();
        f.schedule = ScheduleChoice::Rallly;
        let mut doc = String::new();
        append_mid_services(&mut doc, &f);
        assert!(doc.contains("Rallly"));
    }

    #[test]
    fn schedule_calcom_appended() {
        let mut f = AllFeatures::defaults();
        f.schedule = ScheduleChoice::CalCom;
        let mut doc = String::new();
        append_mid_services(&mut doc, &f);
        assert!(doc.contains("Cal.com"));
    }

    #[test]
    fn notify_gotify_appended() {
        let mut f = AllFeatures::defaults();
        f.notify = NotifyChoice::Gotify;
        let mut doc = String::new();
        append_mid_services(&mut doc, &f);
        assert!(doc.contains("Gotify"));
    }
}
