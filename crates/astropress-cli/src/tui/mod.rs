use std::sync::atomic::{AtomicBool, Ordering};

static PLAIN_MODE: AtomicBool = AtomicBool::new(false);

pub(crate) fn set_plain(plain: bool) {
    PLAIN_MODE.store(plain, Ordering::Relaxed);
}

pub(crate) fn is_plain() -> bool {
    use std::io::IsTerminal;
    PLAIN_MODE.load(Ordering::Relaxed) || !std::io::stdout().is_terminal()
}

/// Show a spinner while in interactive mode, or just print the message in plain mode.
/// Returns Some(ProgressBar) in interactive mode (call `finish_spinner` when done).
pub(crate) fn spinner(message: &str) -> Option<indicatif::ProgressBar> {
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
pub(crate) fn finish_spinner(pb: Option<indicatif::ProgressBar>, done_message: &str) {
    match pb {
        Some(pb) => pb.finish_with_message(done_message.to_string()),
        None => println!("{done_message}"),
    }
}
