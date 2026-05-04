use std::io;

#[derive(Debug, thiserror::Error)]
pub(crate) enum CliError {
    #[error("Unsupported {kind} `{value}`. {hint}")]
    InvalidValue {
        kind: &'static str,
        value: String,
        hint: &'static str,
    },

    #[error("{0}")]
    Io(#[from] io::Error),

    #[error("{0}")]
    Json(#[from] serde_json::Error),

    #[error("{0}")]
    Other(String),
}

impl From<String> for CliError {
    fn from(s: String) -> Self {
        Self::Other(s)
    }
}

impl From<&str> for CliError {
    fn from(s: &str) -> Self {
        Self::Other(s.to_string())
    }
}

// Bridge to String so `?` works at boundaries that still return
// `Result<_, String>`. Removed once W10a finishes and every caller is
// `Result<_, CliError>`.
impl From<CliError> for String {
    fn from(e: CliError) -> Self {
        e.to_string()
    }
}

pub(crate) type CliResult<T> = Result<T, CliError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn invalid_value_displays_kind_value_and_hint() {
        let e = CliError::InvalidValue {
            kind: "thing",
            value: "bogus".to_string(),
            hint: "Use foo or bar.",
        };
        assert_eq!(e.to_string(), "Unsupported thing `bogus`. Use foo or bar.");
    }

    #[test]
    fn from_string_yields_other_variant() {
        let e: CliError = "boom".to_string().into();
        assert_eq!(e.to_string(), "boom");
        assert!(matches!(e, CliError::Other(_)));
    }

    #[test]
    fn from_str_yields_other_variant() {
        let e: CliError = "boom".into();
        assert_eq!(e.to_string(), "boom");
    }

    #[test]
    fn cli_error_into_string_round_trips_via_display() {
        let e = CliError::InvalidValue {
            kind: "x",
            value: "y".to_string(),
            hint: "z",
        };
        let s: String = e.into();
        assert_eq!(s, "Unsupported x `y`. z");
    }

    #[test]
    fn io_error_wraps_via_from() {
        let io = io::Error::new(io::ErrorKind::NotFound, "no");
        let e: CliError = io.into();
        assert!(matches!(e, CliError::Io(_)));
    }
}
