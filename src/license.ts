import { invoke } from "@tauri-apps/api/core";

export type LicenseStatus = {
  activated: boolean;
  sessionsCompleted: number;
  freeSessions: number;
  canStartSession: boolean;
};

export function getLicenseStatus(): Promise<LicenseStatus> {
  return invoke<LicenseStatus>("get_license_status");
}

export function activateLicense(code: string): Promise<LicenseStatus> {
  return invoke<LicenseStatus>("activate_license", { code });
}

export function recordSessionCompleted(): Promise<LicenseStatus> {
  return invoke<LicenseStatus>("record_session_completed");
}
