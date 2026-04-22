#![allow(dead_code)]
//! Ratatui-based import dashboard.
//!
//! Provides a live-updating terminal UI for the WordPress / Wix import pipeline.
//! In plain mode (`--plain` flag or non-TTY stdout) it falls back to the existing
//! indicatif spinner-based display via `crate::tui`.

use std::io;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use crossterm::event::{self, Event, KeyCode};
use ratatui::{
    layout::{Constraint, Layout},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Gauge, List, ListItem, Paragraph},
};

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/// Current status of a single import stage.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum StageStatus {
    Pending,
    Running,
    Done,
    Failed,
}

/// One row in the import progress display.
#[derive(Debug, Clone)]
pub(crate) struct ImportStage {
    pub label: String,
    pub status: StageStatus,
    /// Completed and total units (e.g. files downloaded).
    pub progress: Option<(u64, u64)>,
    /// Short note appended after the label (e.g. "12 / 45 files").
    pub note: Option<String>,
}

impl ImportStage {
    pub(crate) fn pending(label: impl Into<String>) -> Self {
        Self {
            label: label.into(),
            status: StageStatus::Pending,
            progress: None,
            note: None,
        }
    }
}

/// Shared state updated by the import worker thread and read by the render loop.
#[derive(Debug, Default, Clone)]
pub(crate) struct ImportDashboardState {
    pub stages: Vec<ImportStage>,
    pub log_lines: Vec<String>,
    /// Set to true by the worker thread when all work is complete.
    pub done: bool,
    /// Non-None means the import failed.
    pub error: Option<String>,
}

/// Thread-safe handle passed to the import worker so it can post progress updates.
pub(crate) type SharedDashboard = Arc<Mutex<ImportDashboardState>>;

// ---------------------------------------------------------------------------
// Dashboard entry point
// ---------------------------------------------------------------------------

/// Run the import dashboard TUI while the import `work` closure executes.
///
/// In plain mode the dashboard is skipped and `work` is called directly on the
/// current thread.  In interactive mode:
///   - A ratatui terminal UI is initialised.
///   - `work` runs in a background thread and updates `state`.
///   - The render loop redraws every 100 ms and exits once `state.done` is set.
///
/// The caller is responsible for setting `state.done = true` inside `work`
/// when the import finishes (or setting `state.error` on failure).
#[mutants::skip]
pub(crate) fn run_import_dashboard(
    state: SharedDashboard,
    work: impl FnOnce(SharedDashboard) + Send + 'static,
) -> io::Result<()> { // ~ skip
    if crate::tui::is_plain() {
        work(Arc::clone(&state));
        return Ok(());
    }

    // Spawn the import work in a background thread.
    let state_for_worker = Arc::clone(&state);
    let _worker = std::thread::spawn(move || {
        work(state_for_worker);
    });

    let mut terminal = ratatui::init();
    let start = Instant::now();
    let mut final_render_done = false;

    let result = (|| -> io::Result<()> {
        loop {
            let current = state.lock().map(|s| s.clone()).unwrap_or_default();
            let elapsed = start.elapsed();

            terminal.draw(|frame| {
                render_dashboard(frame, &current, elapsed);
            })?;

            // Check for quit keystroke (q or Ctrl-C).
            if event::poll(Duration::from_millis(80))? {
                if let Event::Key(key) = event::read()? {
                    if key.code == KeyCode::Char('q') {
                        break;
                    }
                }
            }

            if current.done || current.error.is_some() {
                if !final_render_done {
                    // One more render with final state.
                    terminal.draw(|frame| {
                        render_dashboard(frame, &current, elapsed);
                    })?;
                    final_render_done = true;
                    std::thread::sleep(Duration::from_millis(800));
                }
                break;
            }
        }
        Ok(())
    })();

    ratatui::restore();
    result
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

#[mutants::skip]
fn render_dashboard(
    frame: &mut ratatui::Frame,
    state: &ImportDashboardState,
    elapsed: Duration,
) { // ~ skip
    let area = frame.area();
    let log_height = (state.log_lines.len().min(8) as u16).max(3);
    let stages_height = (state.stages.len() as u16).saturating_mul(2).max(2);

    let [header_area, stages_area, log_area, footer_area] = Layout::vertical([
        Constraint::Length(3),
        Constraint::Length(stages_height + 2),
        Constraint::Length(log_height + 2),
        Constraint::Length(1),
    ])
    .areas(area);

    // Header ----------------------------------------------------------------
    let secs = elapsed.as_secs();
    let header = Paragraph::new(format!(
        " AstroPress Import  |  Elapsed: {:02}:{:02}",
        secs / 60,
        secs % 60,
    ))
    .block(Block::bordered().title("astropress-cli"))
    .style(Style::default().fg(Color::Cyan));
    frame.render_widget(header, header_area);

    // Stages ----------------------------------------------------------------
    let stage_block = Block::bordered().title("Import progress");
    let stage_inner = stage_block.inner(stages_area);
    frame.render_widget(stage_block, stages_area);

    if !state.stages.is_empty() {
        let row_constraints: Vec<Constraint> = state
            .stages
            .iter()
            .map(|_| Constraint::Length(2))
            .collect();

        let stage_rows = Layout::vertical(row_constraints).split(stage_inner);

        for (i, stage) in state.stages.iter().enumerate() {
            let Some(row_area) = stage_rows.get(i) else {
                break;
            };

            let (ratio, suffix) = match stage.status {
                StageStatus::Pending => (0.0, " ○"),
                StageStatus::Running => {
                    let r = stage
                        .progress
                        .map(|(done, total)| {
                            if total > 0 {
                                done as f64 / total as f64
                            } else {
                                0.0
                            }
                        })
                        .unwrap_or(0.0);
                    (r, " ●")
                }
                StageStatus::Done => (1.0, " ✓"),
                StageStatus::Failed => (1.0, " ✗"),
            };

            let color = match stage.status {
                StageStatus::Pending => Color::DarkGray,
                StageStatus::Running => Color::Yellow,
                StageStatus::Done => Color::Green,
                StageStatus::Failed => Color::Red,
            };

            let note_part = stage
                .note
                .as_deref()
                .map(|n| format!(" — {n}"))
                .unwrap_or_default();

            let label = format!("{}{suffix}{note_part}", stage.label);

            let gauge = Gauge::default()
                .gauge_style(Style::default().fg(color))
                .ratio(ratio.clamp(0.0, 1.0))
                .label(label);
            frame.render_widget(gauge, *row_area);
        }
    }

    // Log panel -------------------------------------------------------------
    let log_items: Vec<ListItem> = state
        .log_lines
        .iter()
        .rev()
        .take(log_height as usize)
        .rev()
        .map(|line| ListItem::new(Line::from(Span::raw(line.as_str()))))
        .collect();
    let log_widget = List::new(log_items)
        .block(Block::bordered().title("Log"))
        .style(Style::default().fg(Color::Gray));
    frame.render_widget(log_widget, log_area);

    // Footer ----------------------------------------------------------------
    let (footer_text, footer_style) = if let Some(err) = state.error.as_deref() {
        (
            format!("Error: {err}"),
            Style::default().fg(Color::Red).add_modifier(Modifier::BOLD),
        )
    } else if state.done {
        (
            "Import complete. Press q to exit.".to_string(),
            Style::default().fg(Color::Green).add_modifier(Modifier::BOLD),
        )
    } else {
        (
            "Press q to abort.".to_string(),
            Style::default().fg(Color::DarkGray),
        )
    };

    let footer = Paragraph::new(footer_text).style(footer_style);
    frame.render_widget(footer, footer_area);
}
