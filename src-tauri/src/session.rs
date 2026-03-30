use serde::Serialize;
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSnapshot {
    pub state: String,
    pub duration_sec: u64,
    pub remaining_sec: u64,
    pub started_at_unix_ms: Option<u128>,
}

#[derive(Debug)]
pub struct SessionState {
    pub state: String,
    pub duration_sec: u64,
    pub started_at: Option<Instant>,
    pub ends_at: Option<Instant>,
}

impl SessionState {
    pub fn new() -> Self {
        Self {
            state: "idle".to_string(),
            duration_sec: 0,
            started_at: None,
            ends_at: None,
        }
    }

    pub fn snapshot(&self) -> SessionSnapshot {
        let remaining_sec = match self.ends_at {
            Some(end) if self.state == "active" => {
                end.saturating_duration_since(Instant::now()).as_secs()
            }
            _ => 0,
        };

        SessionSnapshot {
            state: self.state.clone(),
            duration_sec: self.duration_sec,
            remaining_sec,
            started_at_unix_ms: None,
        }
    }

    pub fn start(&mut self, duration_sec: u64) {
        let now = Instant::now();
        self.state = "active".to_string();
        self.duration_sec = duration_sec;
        self.started_at = Some(now);
        self.ends_at = Some(now + Duration::from_secs(duration_sec));
    }

    pub fn stop(&mut self) {
        self.state = "idle".to_string();
        self.duration_sec = 0;
        self.started_at = None;
        self.ends_at = None;
    }

    pub fn interrupt(&mut self) {
        self.state = "interrupted".to_string();
        self.ends_at = None;
    }

    pub fn maybe_complete(&mut self) -> bool {
        if self.state == "active" {
            if let Some(end) = self.ends_at {
                if Instant::now() >= end {
                    self.state = "completed".to_string();
                    self.ends_at = None;
                    return true;
                }
            }
        }
        false
    }
}
