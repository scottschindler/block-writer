import { invoke } from "@tauri-apps/api/core";

export type SessionState = "idle" | "active" | "completed";

export type SessionSnapshot = {
  state: SessionState;
  durationSec: number;
  remainingSec: number;
  startedAtUnixMs?: number | null;
};

export function startSession(durationSec: number): Promise<SessionSnapshot> {
  return invoke<SessionSnapshot>("start_session", { durationSec });
}

export function getSession(): Promise<SessionSnapshot> {
  return invoke<SessionSnapshot>("get_session");
}

export function stopSession(): Promise<SessionSnapshot> {
  return invoke<SessionSnapshot>("stop_session");
}

export function interruptSession(passphrase: string, expectedPassphrase: string): Promise<SessionSnapshot> {
  return invoke<SessionSnapshot>("interrupt_session", { passphrase, expectedPassphrase });
}
