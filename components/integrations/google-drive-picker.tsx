"use client";

import { api } from "@/api/api";

// Loads Google's own Picker widget (not published as an npm/ESM package — the standard integration
// path is the `apis.google.com/js/api.js` script) so file selection can stay on the narrow "drive.file"
// OAuth scope: Picker grants this app access to exactly the file the person selects, whether that's an
// import source or an export-overwrite target. The access token used to authorize the Picker comes from
// the workspace's own persistent Google Drive connection (googleDrivePickerToken), refreshed server-side
// as needed — there is no separate client-side OAuth handshake.

type PickerDoc = { id: string; name: string; mimeType: string };
type PickerResponse = { action: string; docs?: PickerDoc[] };
type PickerView = { setIncludeFolders: (value: boolean) => PickerView; setSelectFolderEnabled: (value: boolean) => PickerView };
type PickerInstance = { setVisible: (visible: boolean) => void };
type PickerBuilder = {
  addView: (view: PickerView) => PickerBuilder;
  setOAuthToken: (token: string) => PickerBuilder;
  setDeveloperKey: (key: string) => PickerBuilder;
  setTitle: (title: string) => PickerBuilder;
  setCallback: (callback: (data: PickerResponse) => void) => PickerBuilder;
  build: () => PickerInstance;
};
type PickerNamespace = {
  DocsView: new (viewId: unknown) => PickerView;
  PickerBuilder: new () => PickerBuilder;
  ViewId: { DOCS: unknown };
  Action: { PICKED: string; CANCEL: string };
};

declare global {
  interface Window {
    gapi?: { load: (api: string, callback: () => void) => void };
    google?: { picker: PickerNamespace };
  }
}

let loadPromise: Promise<void> | null = null;

function loadPickerScript(): Promise<void> {
  if (window.google?.picker) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.onload = () => {
      window.gapi?.load("picker", () => resolve());
    };
    script.onerror = () => reject(new Error("Could not load Google's file picker."));
    document.head.appendChild(script);
  });
  return loadPromise;
}

export type GoogleDrivePickResult = { fileId: string; name: string; mimeType: string };

/**
 * Opens the Google Drive Picker. `mode: "import"` lets the person pick any file to bring into PRISM;
 * `mode: "export"` is used to pick an existing file to overwrite. Resolves with the picked file, or
 * null if the person cancelled.
 */
export async function openGoogleDrivePicker(
  mode: "import" | "export" = "import",
): Promise<GoogleDrivePickResult | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
  if (!apiKey) throw new Error("Google Drive picker isn't configured (NEXT_PUBLIC_GOOGLE_API_KEY is missing).");

  const token = await api.googleDrivePickerToken();
  if (!token) throw new Error("Connect Google Drive first, from Settings → Integrations.");

  await loadPickerScript();
  const picker = window.google?.picker;
  if (!picker) throw new Error("Could not load Google's file picker.");

  return new Promise((resolve, reject) => {
    try {
      const view = new picker.DocsView(picker.ViewId.DOCS).setIncludeFolders(true).setSelectFolderEnabled(false);
      const builder = new picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(token)
        .setDeveloperKey(apiKey)
        .setTitle(mode === "export" ? "Choose a file to replace" : "Choose a file to bring into PRISM")
        .setCallback((data: PickerResponse) => {
          if (data.action === picker.Action.PICKED) {
            const picked = data.docs?.[0];
            if (picked) {
              resolve({ fileId: picked.id, name: picked.name, mimeType: picked.mimeType });
              return;
            }
          }
          if (data.action === picker.Action.CANCEL) resolve(null);
        });
      builder.build().setVisible(true);
    } catch (cause) {
      reject(cause instanceof Error ? cause : new Error("Could not open Google's file picker."));
    }
  });
}
