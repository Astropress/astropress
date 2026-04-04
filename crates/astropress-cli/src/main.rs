use std::env;
use std::process::ExitCode;

fn main() -> ExitCode {
    let args = env::args().skip(1).collect::<Vec<_>>();
    match parse_command(&args) {
        Ok(Command::New) => {
            println!("astropress new: scaffold command placeholder");
            ExitCode::SUCCESS
        }
        Ok(Command::Dev) => {
            println!("astropress dev: local runtime command placeholder");
            ExitCode::SUCCESS
        }
        Ok(Command::ImportWordPress) => {
            println!("astropress import wordpress: migration command placeholder");
            ExitCode::SUCCESS
        }
        Ok(Command::SyncExport) => {
            println!("astropress sync export: git/export command placeholder");
            ExitCode::SUCCESS
        }
        Ok(Command::SyncImport) => {
            println!("astropress sync import: git/import command placeholder");
            ExitCode::SUCCESS
        }
        Ok(Command::Deploy) => {
            println!("astropress deploy: provider deployment command placeholder");
            ExitCode::SUCCESS
        }
        Ok(Command::Help) => {
            print_help();
            ExitCode::SUCCESS
        }
        Err(message) => {
            eprintln!("{message}");
            eprintln!();
            print_help();
            ExitCode::from(2)
        }
    }
}

#[derive(Debug, PartialEq, Eq)]
enum Command {
    New,
    Dev,
    ImportWordPress,
    SyncExport,
    SyncImport,
    Deploy,
    Help,
}

fn parse_command(args: &[String]) -> Result<Command, String> {
    match args {
        [] => Ok(Command::Help),
        [flag] if flag == "--help" || flag == "-h" || flag == "help" => Ok(Command::Help),
        [command] if command == "new" => Ok(Command::New),
        [command] if command == "dev" => Ok(Command::Dev),
        [command] if command == "deploy" => Ok(Command::Deploy),
        [command, subcommand] if command == "import" && subcommand == "wordpress" => {
            Ok(Command::ImportWordPress)
        }
        [command, subcommand] if command == "sync" && subcommand == "export" => {
            Ok(Command::SyncExport)
        }
        [command, subcommand] if command == "sync" && subcommand == "import" => {
            Ok(Command::SyncImport)
        }
        [command, ..] if command == "import" => {
            Err("Unsupported import source. Only `astropress import wordpress` is available.".into())
        }
        [command, ..] if command == "sync" => {
            Err("Unsupported sync subcommand. Use `astropress sync export` or `astropress sync import`.".into())
        }
        [command, ..] => Err(format!("Unsupported astropress command: `{command}`.")),
    }
}

fn print_help() {
    println!("astropress-cli");
    println!("Commands:");
    println!("  astropress new");
    println!("  astropress dev");
    println!("  astropress import wordpress");
    println!("  astropress sync export");
    println!("  astropress sync import");
    println!("  astropress deploy");
}

#[cfg(test)]
mod tests {
    use super::{parse_command, Command};

    fn strings(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    #[test]
    fn parses_top_level_commands() {
        assert_eq!(parse_command(&strings(&["new"])), Ok(Command::New));
        assert_eq!(parse_command(&strings(&["dev"])), Ok(Command::Dev));
        assert_eq!(parse_command(&strings(&["deploy"])), Ok(Command::Deploy));
    }

    #[test]
    fn parses_nested_commands() {
        assert_eq!(
            parse_command(&strings(&["import", "wordpress"])),
            Ok(Command::ImportWordPress)
        );
        assert_eq!(
            parse_command(&strings(&["sync", "export"])),
            Ok(Command::SyncExport)
        );
        assert_eq!(
            parse_command(&strings(&["sync", "import"])),
            Ok(Command::SyncImport)
        );
    }

    #[test]
    fn falls_back_to_help() {
        assert_eq!(parse_command(&strings(&[])), Ok(Command::Help));
        assert_eq!(parse_command(&strings(&["--help"])), Ok(Command::Help));
    }

    #[test]
    fn rejects_unknown_subcommands() {
        let import_error = parse_command(&strings(&["import", "ghost"])).unwrap_err();
        assert!(import_error.contains("Unsupported import source"));

        let sync_error = parse_command(&strings(&["sync", "push"])).unwrap_err();
        assert!(sync_error.contains("Unsupported sync subcommand"));
    }

    #[test]
    fn rejects_unknown_commands() {
        let error = parse_command(&strings(&["explode"])).unwrap_err();
        assert!(error.contains("Unsupported astropress command"));
    }
}
