use std::env;
use std::path::PathBuf;

use super::{Command, CrawlMode};

pub(super) fn parse_import_wordpress_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut source_path: Option<PathBuf> = None;
    let mut url: Option<String> = None;
    let mut credentials_file: Option<PathBuf> = None;
    let mut username: Option<String> = None;
    let mut password: Option<String> = None;
    let mut artifact_dir = None;
    let mut download_media = false;
    let mut apply_local = false;
    let mut resume = false;
    let mut crawl_mode = CrawlMode::None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--project-dir" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--project-dir`.".to_string())?;
                project_dir = PathBuf::from(value);
            }
            "--source" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--source`.".to_string())?;
                source_path = Some(PathBuf::from(value));
            }
            "--url" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--url`.".to_string())?;
                url = Some(value.clone());
            }
            "--credentials-file" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--credentials-file`.".to_string())?;
                credentials_file = Some(PathBuf::from(value));
            }
            "--username" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--username`.".to_string())?;
                username = Some(value.clone());
            }
            "--password" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--password`.".to_string())?;
                password = Some(value.clone());
            }
            "--artifact-dir" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--artifact-dir`.".to_string())?;
                artifact_dir = Some(PathBuf::from(value));
            }
            "--download-media" => download_media = true,
            "--apply-local" => apply_local = true,
            "--resume" => resume = true,
            "--crawl-pages" => crawl_mode = CrawlMode::Fetch,
            "--crawl-pages=playwright" => crawl_mode = CrawlMode::Browser,
            other => {
                return Err(format!(
                    "Unsupported astropress import wordpress option: `{other}`."
                ))
            }
        }
        index += 1; // ~ skip
    }

    if source_path.is_none() && url.is_none() {
        return Err(
            "Usage: `astropress import wordpress --source <export.xml>` or `astropress import wordpress --url <https://mysite.com>`."
                .to_string(),
        );
    }
    if source_path.is_some() && url.is_some() {
        return Err("Cannot use both `--source` and `--url` at the same time.".to_string());
    }

    Ok(Command::ImportWordPress {
        project_dir,
        source_path,
        url,
        credentials_file,
        username,
        password,
        artifact_dir,
        download_media,
        apply_local,
        resume,
        crawl_mode,
    })
}

pub(super) fn parse_import_wix_command(args: &[String]) -> Result<Command, String> {
    let mut project_dir = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut source_path: Option<PathBuf> = None;
    let mut url: Option<String> = None;
    let mut credentials_file: Option<PathBuf> = None;
    let mut email: Option<String> = None;
    let mut password: Option<String> = None;
    let mut artifact_dir = None;
    let mut download_media = false;
    let mut apply_local = false;
    let mut resume = false;
    let mut crawl_mode = CrawlMode::None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--project-dir" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--project-dir`.".to_string())?;
                project_dir = PathBuf::from(value);
            }
            "--source" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--source`.".to_string())?;
                source_path = Some(PathBuf::from(value));
            }
            "--url" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--url`.".to_string())?;
                url = Some(value.clone());
            }
            "--credentials-file" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--credentials-file`.".to_string())?;
                credentials_file = Some(PathBuf::from(value));
            }
            "--email" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--email`.".to_string())?;
                email = Some(value.clone());
            }
            "--password" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--password`.".to_string())?;
                password = Some(value.clone());
            }
            "--artifact-dir" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "Missing value after `--artifact-dir`.".to_string())?;
                artifact_dir = Some(PathBuf::from(value));
            }
            "--download-media" => download_media = true,
            "--apply-local" => apply_local = true,
            "--resume" => resume = true,
            "--crawl-pages" => crawl_mode = CrawlMode::Fetch,
            "--crawl-pages=playwright" => crawl_mode = CrawlMode::Browser,
            other => {
                return Err(format!(
                    "Unsupported astropress import wix option: `{other}`."
                ))
            }
        }
        index += 1; // ~ skip
    }

    if source_path.is_none() && url.is_none() {
        return Err(
            "Usage: `astropress import wix --source <export.csv>` or `astropress import wix --url <https://username.wixsite.com/mysite>`."
                .to_string(),
        );
    }
    if source_path.is_some() && url.is_some() {
        return Err("Cannot use both `--source` and `--url` at the same time.".to_string());
    }

    Ok(Command::ImportWix {
        project_dir,
        source_path,
        url,
        credentials_file,
        email,
        password,
        artifact_dir,
        download_media,
        apply_local,
        resume,
        crawl_mode,
    })
}
