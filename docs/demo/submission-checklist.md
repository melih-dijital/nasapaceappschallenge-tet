# Submission Checklist — Astro Health Cockpit (NASA Space Apps 2026)

> **Freeze Rule:** Zero new feature code or refactors in the final **2 hours** before `2026-11-15 23:59` (submission timezone confirmed by team). Only documentation, rehearsal, video, slides, and final verification belong here.

---

## 1. Repository, Licensing & Secrets Hygiene

- [x] **No secrets or `.env` files committed to Git:**
  - Verified working tree & tracked files: `Get-ChildItem -Force -Filter "*.env*"` returned none; `git ls-files "*env*"` empty; `git grep` scan for `AKIA`/`AIza`/`ghp_`/`sk-`/`BEGIN PRIVATE KEY` exited `1` (no matches).
  - Re-run full commit-history scan in PowerShell before final submission:
    ```powershell
    git log -p | Select-String -Pattern "AKIA|AIza|ghp_|sk-|PRIVATE KEY|token|secret"
    ```
- [ ] **Public GitHub repository & OSS `LICENSE` file in root directory:**
  - Team must make repository public on GitHub and add the chosen open-source `LICENSE` file (MIT recommended) at repo root.
- [ ] **All team members' branches cleanly merged on `main` & `npm.cmd run check` green:**
  - Current blocker: `origin/main` commit `f7416a2` (`faz-10`) has TypeScript & ESLint errors inside `src/ui/**` and `tests/ui/faz10-pages.test.tsx` (`tsc -b` fails). Must be fixed by Kişi A (or approved `[cross-owner]` fix) before final freeze.

---

## 2. Technical Verification & Offline Readiness

- [x] **Validation report is up to date ([validation-report.md](file:///c:/Users/geerv/Documents/nasapaceappschallenge-tet-main/nasapaceappschallenge-tet-main/docs/demo/validation-report.md), [validation-report.json](file:///c:/Users/geerv/Documents/nasapaceappschallenge-tet-main/nasapaceappschallenge-tet-main/docs/demo/validation-report.json)):**
  - Latest full run (`REPORT_SEEDS = 100..119`, fingerprint `fnv1a-0af1f79b4d5f4413`): `nominalFpPerCrewDay = 0.025 <= 0.1` (`PASS`), `strongRecall = 95.3% >= 90%` (`PASS`), `speDetectP90Min = 15.0 <= 60` (`PASS`), overfitting `gap = -1.5% <= 15%`, mandatory limitations present.
- [ ] **Production build & preview smoke (`npm.cmd run build` then separate `npm.cmd run preview`):**
  - Blocked until Kişi A's `f7416a2` UI TypeScript errors are resolved so `tsc -b && vite build` succeeds on `HEAD`.
- [ ] **Live Vercel URL verified in incognito window AND offline (Service Worker / Airplane mode):**
  - Verify `vercel.json` CSP headers (`script-src 'self'`, `worker-src 'self' blob:`), zero console/CSP errors, `?demo=1` update prompt suppression, reload offline, and 3 consecutive `demo_main` (`seed = 42`) rehearsals under 90s.

---

## 3. Narrative, Citations & AI Disclosure

- [x] **README narrative sections updated ([README.md](file:///c:/Users/geerv/Documents/nasapaceappschallenge-tet-main/nasapaceappschallenge-tet-main/README.md)):**
  - Problem, solution, architecture diagram, how to run, offline/ws setup, data provenance policy, honest limitations, NASA/CSA references, and AI usage disclosure written.
- [x] **Documentation rewrite draft prepared ([documentation-rewrite-draft.md](file:///c:/Users/geerv/Documents/nasapaceappschallenge-tet-main/nasapaceappschallenge-tet-main/docs/demo/documentation-rewrite-draft.md)):**
  - Replaces legacy backend/Railway/Render narrative with onboard browser/Web Worker architecture and honest `EvidenceRegistry` provenance.
- [ ] **AI usage disclosure double-checked against official Space Apps 2026 rules:**
  - Verify wording on spaceappschallenge.org submission form, README, and final pitch deck (`AI tools used: Claude (Anthropic)` / coding assistants disclosed transparently).

---

## 4. Challenge Portal Submission Package (`spaceappschallenge.org`)

- [ ] **Official portal fields finalized (project title, high-level summary, challenge selection, all Team TET members listed):** Check exact submission deadline & timezone on `spaceappschallenge.org`.
- [ ] **Live Demo URL added to README & portal form** (Vercel production URL).
- [ ] **Demo Video recorded, subtitled (EN), uploaded (public or unlisted), and verified playable:**
  - Target 2–3 min structure: Problem (10s) -> Solution (20s) -> Live Demo (`demo_main`, 60–90s per [demo-script.md](file:///c:/Users/geerv/Documents/nasapaceappschallenge-tet-main/nasapaceappschallenge-tet-main/docs/demo/demo-script.md)) -> Impact/Limitations (20s). Check official video duration cap.
- [ ] **Slide Deck exported to PDF (max 6 slides):**
  - Problem, Solution, Architecture (single diagram), Evidence & Validation (`validation-report.md`), Live Screenshots, Vision & Honest Limitations. Exported PDF uses updated architecture (not the legacy PDF).
- [ ] **Submitted >= 2 hours before `23:59` deadline & confirmation receipt/screenshot archived.**
- [ ] **Offline/Cloud Backups secured:**
  - `dist/` archive (`.zip`), rendered demo video (`.mp4`), pitch slides (`.pdf`), and rewritten documentation PDF saved both locally and in team cloud drive.
