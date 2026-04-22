pub(crate) fn print_help() {
    println!("astropress-cli  v{}", env!("CARGO_PKG_VERSION"));
    println!();
    println!("Global flags:");
    println!("  --version / -V        Print the CLI version and exit");
    println!(
        "  --plain / --no-tui    Disable interactive prompts and progress bars (for CI/AI use)"
    );
    println!();
    println!("Commands:");
    println!("  astropress new [project-dir] [--app-host <host>] [--content-services <services>] [--yes] [--use-local-package|--use-published-package]");
    println!("  astropress init [project-dir] [--app-host <host>] [--content-services <services>] [--yes]  (alias for `new`)");
    println!("  astropress dev [project-dir] [--app-host <host>] [--content-services <services>]");
    println!("  astropress import wordpress --source <export.xml> [--project-dir <dir>] [--artifact-dir <dir>] [--download-media] [--apply-local] [--resume]");
    println!("  astropress import wordpress --url <https://mysite.com> [--credentials-file <file>] [--username <u>] [--password <p>] [--crawl-pages[=playwright]] [--project-dir <dir>] [--artifact-dir <dir>] [--download-media] [--apply-local]");
    println!("  astropress import wix --source <export.csv> [--project-dir <dir>] [--artifact-dir <dir>] [--download-media] [--apply-local] [--resume]");
    println!("  astropress import wix --url <https://username.wixsite.com/mysite> [--credentials-file <file>] [--email <e>] [--password <p>] [--crawl-pages[=playwright]] [--project-dir <dir>] [--artifact-dir <dir>] [--download-media] [--apply-local]");
    println!("  astropress backup [--project-dir <dir>] [--out <snapshot-dir>]");
    println!("  astropress restore --from <snapshot-dir> [--project-dir <dir>]");
    println!("  astropress doctor [--project-dir <dir>] [--strict]");
    println!("  astropress services bootstrap [--project-dir <dir>]");
    println!("  astropress services verify [--project-dir <dir>]");
    println!("  astropress config migrate [--project-dir <dir>] [--dry-run]");
    println!("  astropress db migrate [--project-dir <dir>] [--migrations-dir <dir>] [--target local|d1] [--dry-run]");
    println!("  astropress db rollback [--project-dir <dir>] [--target local|d1] [--dry-run]");
    println!("  astropress sync export [--project-dir <dir>] [--out <snapshot-dir>]");
    println!("  astropress sync import --from <snapshot-dir> [--project-dir <dir>]");
    println!("  astropress deploy [--project-dir <dir>] [--app-host <host>] [--target github-pages|cloudflare|vercel|netlify|render-static|render-web|gitlab-pages|custom]");
    println!();
    println!("  astropress list tools      (alias: ls tools)      List all tools by category");
    println!("  astropress list providers  (alias: ls providers)  List supported hosts and data services with pairings");
    println!("  astropress completions <bash|zsh|fish|powershell> Print shell completion script");
    println!("  astropress auth emergency-revoke --all [--user <email>] [--project-dir <dir>]");
    println!("  astropress auth emergency-revoke --sessions-only [--user <email>] [--project-dir <dir>]");
    println!("  astropress auth emergency-revoke --tokens-only [--project-dir <dir>]");
    println!("  astropress telemetry status   Show whether anonymous usage data sharing is on or off");
    println!("  astropress telemetry enable   Opt in to anonymous usage data sharing");
    println!("  astropress telemetry disable  Opt out of anonymous usage data sharing");
    println!();
    println!("New project flags:");
    println!("  --yes / --defaults    Skip interactive prompts and use defaults (for CI use)");
    println!();
    println!("Crawl modes:");
    println!("  --crawl-pages              Fast fetch-based crawl (uses sitemap + HTML fetch)");
    println!(
        "  --crawl-pages=playwright   Full browser crawl (handles JS-rendered pages, e.g. Wix)"
    );
}
