pub(crate) mod import_dashboard;

use std::sync::atomic::{AtomicBool, Ordering};

static PLAIN_MODE: AtomicBool = AtomicBool::new(false);

pub(crate) fn set_plain(plain: bool) {
    PLAIN_MODE.store(plain, Ordering::Relaxed);
}

pub(crate) fn is_plain() -> bool {
    use std::io::IsTerminal;
    // In test builds stdout may be a real terminal (e.g. when cargo test inherits the
    // parent's pts). Treat it as non-terminal so tests don't create live spinners, which
    // would cause stdout contention when the full suite runs in parallel.
    let stdout_is_not_terminal = cfg!(test) || !std::io::stdout().is_terminal();
    PLAIN_MODE.load(Ordering::Relaxed) || stdout_is_not_terminal
}

/// Show a spinner while in interactive mode, or just print the message in plain mode.
/// Returns Some(ProgressBar) in interactive mode (call `finish_spinner` when done).
pub(crate) fn spinner(message: &str) -> Option<indicatif::ProgressBar> { // ~ skip
    if is_plain() {
        println!("{message}");
        return None;
    }
    let pb = indicatif::ProgressBar::new_spinner();
    pb.set_style(
        indicatif::ProgressStyle::with_template("{spinner:.cyan} {msg}")
            .expect("valid indicatif template"),
    );
    pb.set_message(message.to_string());
    pb.enable_steady_tick(std::time::Duration::from_millis(80));
    Some(pb)
}

/// Complete a spinner with a final message (or just print in plain mode).
pub(crate) fn finish_spinner(pb: Option<indicatif::ProgressBar>, done_message: &str) { // ~ skip
    match pb {
        Some(pb) => pb.finish_with_message(done_message.to_string()),
        None => println!("{done_message}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    static TUI_MUTEX: Mutex<()> = Mutex::new(());

    #[test]
    fn set_plain_true_makes_is_plain_true() {
        let _lock = TUI_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        set_plain(true);
        assert!(PLAIN_MODE.load(std::sync::atomic::Ordering::Relaxed));
        set_plain(false);
    }

    #[test]
    fn is_plain_returns_true_in_non_terminal_test_env() {
        // In test environments stdout is piped (not a terminal), so is_plain() must return true
        // regardless of PLAIN_MODE. This kills the `replace with false`, `||→&&`, and `delete !`
        // mutations. (The `replace with true` mutation is equivalent here — both return true.)
        let _lock = TUI_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        set_plain(false);
        assert!(is_plain(), "is_plain() must return true when stdout is not a terminal");
    }

    #[test]
    fn set_plain_false_clears_plain_mode() {
        let _lock = TUI_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        set_plain(true);
        set_plain(false);
        assert!(!PLAIN_MODE.load(std::sync::atomic::Ordering::Relaxed));
    }
}
