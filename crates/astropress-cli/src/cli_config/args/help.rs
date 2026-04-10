pub(crate) fn print_help() {
    println!("astropress-cli");
    println!();
    println!("Global flags:");
    println!("  --plain / --no-tui    Disable interactive prompts and progress bars (for CI/AI use)");
    println!();
    println!("Commands:");
    println!("  astropress new [project-dir] [--app-host <host>] [--content-services <services>] [--use-local-package|--use-published-package]");
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
    println!("  astropress db migrate [--project-dir <dir>] [--migrations-dir <dir>] [--dry-run]");
    println!("  astropress sync export [--project-dir <dir>] [--out <snapshot-dir>]");
    println!("  astropress sync import --from <snapshot-dir> [--project-dir <dir>]");
    println!("  astropress deploy [--project-dir <dir>] [--app-host <host>] [--target github-pages|cloudflare|vercel|netlify|render-static|render-web|gitlab-pages|firebase-hosting|runway|custom]");
    println!();
    println!("Crawl modes:");
    println!("  --crawl-pages              Fast fetch-based crawl (uses sitemap + HTML fetch)");
    println!("  --crawl-pages=playwright   Full browser crawl (handles JS-rendered pages, e.g. Wix)");
}
