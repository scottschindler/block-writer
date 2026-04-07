import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export interface UpdateResult {
  available: boolean;
  version?: string;
  update?: Update;
}

export async function checkForUpdate(): Promise<UpdateResult> {
  const update = await check();
  if (update) {
    return { available: true, version: update.version, update };
  }
  return { available: false };
}

export async function installUpdate(update: Update): Promise<void> {
  await update.downloadAndInstall();
  await relaunch();
}
