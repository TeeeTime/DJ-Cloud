# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## macOS install note

The app is ad-hoc signed but not notarized (no paid Apple Developer account yet), so macOS
Gatekeeper shows an "unidentified developer" warning on first launch. To open it:

1. Right-click (or Control-click) the app in Finder and choose **Open**, then confirm in the
   dialog that appears. This only needs to be done once.
2. If that still refuses to open it, remove the quarantine flag manually:
   ```
   xattr -cr "/Applications/DJ Cloud Desktop.app"
   ```
