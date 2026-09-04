import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface AuthInfo {
  token: string;
  username: string;
}

export interface AppSettings {
  libraryFolder: string | null;
}

export interface SyncSummary {
  playlistsSynced: number;
  downloaded: number;
  failed: number;
}

export interface SyncProgressEvent {
  phase: "scanning" | "downloading" | "done";
  filesCompleted: number;
  filesTotal: number;
  currentPlaylist: string | null;
  currentFile: string | null;
  bytesDownloaded: number;
  bytesTotal: number | null;
}

export const commands = {
  getAuthToken: () => invoke<AuthInfo | null>("get_auth_token"),
  clearAuthToken: () => invoke<void>("clear_auth_token"),
  validateAuthToken: () => invoke<boolean>("validate_auth_token"),

  getSettings: () => invoke<AppSettings>("get_settings"),
  setLibraryFolder: (folder: string) => invoke<void>("set_library_folder", { folder }),

  syncLibrary: () => invoke<SyncSummary>("sync_library"),
};

export function onAuthTokenReceived(handler: (auth: AuthInfo) => void): Promise<UnlistenFn> {
  return listen<AuthInfo>("auth-token-received", (event) => handler(event.payload));
}

export function onSyncProgress(handler: (progress: SyncProgressEvent) => void): Promise<UnlistenFn> {
  return listen<SyncProgressEvent>("sync-progress", (event) => handler(event.payload));
}
