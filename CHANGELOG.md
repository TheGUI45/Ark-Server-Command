# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2025-11-21
## [0.2.1] - 2025-11-21
### Added
- Claude AI integration: settings for enabling feature, storing Anthropic API key, and overriding model id.
- ClaudePanel: basic prompt input with single-shot completion and streaming token updates.
- Main process `ClaudeService` with simple rate limiting, non-stream and streaming IPC (`claude:complete`, `claude:stream`).
- Preload bridge exposure (`api.claude.complete`, `api.claude.stream`).

### Security
- API key stored locally (settings.json). Never logged to console. Offline Mode blocks Claude requests.

### Notes
- Default model id set to `claude-sonnet-4.5` (adjustable under Settings > Claude AI).
- Streaming parses SSE events and appends text deltas in real time.

### Added
- Mods panel: CurseForge-style hover previews with thumbnail, authors, downloads, categories, latest file, automatic overflow handling and fade animations.
- Mods panel: Steam workshop mod hover info (size, file count, presence) with 30‑minute disk caching to reduce recomputation.
- Tooltip system: Debounced data fetching, skeleton loading indicators, dynamic repositioning (horizontal/vertical flip to avoid viewport overflow).
- Settings panel: New "Application Update" fieldset providing Git-based update (`git fetch --all --prune` + `git pull --rebase`) and in-app restart button.
- Main process IPC: `app:updateFromGit`, `app:restart`, and `mods:getSteamModInfo` (with persistent cache file `steam-mod-info-cache.json`).

### Changed
- Enhanced CurseForge integration with hover detail caching and offline-mode respect.
- Improved UX consistency across panels with structured status indicators.

### Notes
- Git update works only when running from an unpacked directory containing a `.git` folder and with `git` available on PATH.
- Offline Mode blocks Git update and external API calls by design.

## [0.1.0] - Initial release
- Initial project setup and baseline server management features.

---
Changelog follows [Keep a Changelog](https://keepachangelog.com/) and uses semantic versioning.