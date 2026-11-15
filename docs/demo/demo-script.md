# Demo Script — Astro Health Cockpit (60–90s Live Flow)

> **Core pitch differentiator:** *"Most tools alert on a number. We tell the crew whether they can wait for Earth."*
> **Mandatory disclaimer:** Decision support prototype using deterministic synthetic telemetry (`demo_main`, `seed = 42`). Not a medical device or diagnostic tool.

---

## Pre-Demo Setup & Preflight Check ("Demo Yangını")

1. **URL:** Open `http://localhost:5173/?demo=1` (or deployed `?demo=1` URL) so PWA update prompts do not interrupt the presentation (`src/pwa/PwaStatus.tsx`).
2. **Scenario & Seed:** Select `demo_main` (`seed = 42`, `MARS_TRANSIT`, 4 crew: `CDR`, `MD`, `ENG`, `SCI`, 14-day backfill + 6-day mission).
3. **Engine Mode:** Verify live Web Worker mode (NOT `?mock=1` fallback unless live UI build is unavailable) and reset simulation before starting recording (`Reset`).
4. **Known Pre-Demo Findings (verify resolved before recording):**
   - `origin/main` (`f7416a2`) currently has TypeScript/ESLint errors in `src/ui/**` blocking `npm run build` / `vite preview` until Kişi A fixes UI types.
   - `src/App.tsx` defines `<Routes>` for `/`, `/evidence`, `/validation`, `/ground`; `AppShell.tsx` checks `location.pathname` for `/alerts` and `/behavioral` (wildcard/route alignment should be verified in browser).
   - Bookmark label `bookmark.demo_main.3` currently reads `D+002 Solar Particle Event`, whereas `src/sim/scenarios/demoMain.ts` injects `SPE_START` at `3 * MS_PER_DAY + 12 * MS_PER_HOUR` (`D+003 12:00`); speak to the on-screen MET clock rather than guessing day numbers.

---

## 6-Step Live Script (Total Target: ~75 Seconds)

| Step | Timing | Action / Control | Expected Screen State | Single Sentence to Say |
|---|---|---|---|---|
| **1. Calm Baseline** | `0:00 – 0:08` (8s) | Open `/` (`demo_main`), let run briefly at `1×` or `5×` on `CDR`. | Top bar shows `MET`, `MARS_MIN` (`180s` one-way), persistent disclaimer bar. All 7 status chips nominal/green (`HR`, `SpO2`, `Sleep`, `Radiation`, `Mood`, `Hydration`, `PVT`), HR telemetry shows shaded `14-day` personal baseline band (`confidence ≈ 1.0`). | *"Right after a 14-day personal baseline backfill in Mars transit, the cockpit tracks vitals, sleep, behavior, and radiation completely offline inside the browser."* |
| **2. CDR Sleep Debt ("Why?")** | `0:08 – 0:20` (12s) | Click Bookmark `bookmark-btn-0` (`Sleep Deficit Onset`), step to end of Day 0 / open "Why?" details (`Alerts`). | `CDR` shows `sleep_debt` (`ADVISORY` / `CAN_WAIT_FOR_EARTH`). Explanation drawer lists `whyKeys[]`, contributing metric weights (sleep duration `-2.0 h` z-score below CDR's own baseline), `DEMO_PARAMETER` provenance tag, and confidence score. | *"Instead of relying on generic population thresholds, Layer 2 and Layer 4 explain why the Commander's sleep deficit stands out against their own 14-day median and MAD."* |
| **3. SCI Behavioral & Mood Decline** | `0:20 – 0:32` (12s) | Select `SCI`, click Bookmark `bookmark-btn-1` (`SCI Mood Decline`), open `/behavioral` or Behavioral card. | `SCI` surfaces gradual `mood_decline` (`stress` up, `mood`/`motivation` down), passive proxies (sleep regularity / check-in trend), `60s PVT` widget, and local-only onboard journal indicator ("never leaves device"). | *"Behavioral check-ins, reaction time tests, and passive proxies detect gradual crew strain early—while private journal entries stay strictly on-device."* |
| **4. Solar Particle Event (CRITICAL + `ACT_NOW`)** | `0:32 – 0:52` (20s) | Click Bookmark `bookmark-btn-3` (`Solar Particle Event`, advance past `+30 sim-min` into SPE). Select `CDR`. | Dose rate spikes (`peakMultiplier = 8`, `200 pfu`), `RadiationModule` transitions `SUSPECTED → CONFIRMED`. Top red critical banner appears (`ACT_NOW` + ack buttons + optional alert tone). Priority decision card shows `ACT_SHELTER`, **schedule diff** cancels resistive exercise and locks protective shelter block, career gauge stays under `600 mSv` and event bar tracks against `250 mSv` **"design reference SPE protection target"**. | *"When a Solar Particle Event hits and Earth round-trip delay climbs to 55 minutes, the cockpit immediately declares `ACT_NOW`, prioritizes sheltering, and reshapes the crew's 24-hour schedule locally."* |
| **5. Earth Link Latency & Store-and-Forward** | `0:52 – 1:05` (13s) | Open `/ground` (or right-hand Earth Link panel) during `EARTH_DELAY` (`1200s` one-way = `20 min`, `≈ 55 min` round-trip). | Earth Link badge displays `20 min` one-way / `55 min` round-trip (`groundProcessingMin = 15 min`). `ACT_SHELTER` packet sits in Outbox/Pending reply with live `remainingMs` countdown, continuous `15-min` telemetry batches feed Ground Mirror (`asOfT` 20 min behind spacecraft), consent toggles respected, journal fields stripped. | *"Even as telemetry batches and alert packets ride a 55-minute store-and-forward loop to Earth for flight surgeon review, the crew has already taken safe shelter without waiting."* |
| **6. Evidence & Synthetic Validation** | `1:05 – 1:20` (15s) | Navigate to `/evidence`, then `/validation` (and mention `docs/demo/validation-report.md`). | `/evidence` distinguishes `NASA_STD` (`600 mSv`, `250 mSv` design-ref target) and `NASA_HRP` from `UNVERIFIED DEMO_PARAMETER` thresholds. `/validation` surfaces synthetic metrics (`95.3%` strong recall, `0.025` nominal FP/crew-day, `15 min` SPE P90 delay), separate `ADVISORY` count, overfitting gap (`-1.5%`), and mandatory limitations. | *"Every number carries an explicit provenance tag—from verified NASA standards to clearly marked demo parameters—and our deterministic validation runner reports recall, false positives, and synthetic limitations openly."* |

---

## Reproducibility Verification Protocol (3 Consecutive Runs)

Before recording or live pitch:
1. Run `demo_main` (`seed = 42`) headless (`npm.cmd run validate` confirms `fnv1a-0af1f79b4d5f4413` determinism) and run 3 consecutive browser resets (`Reset` -> Bookmark 1..4).
2. Confirm identical MET timestamps for CDR `sleep_debt`, SCI `mood_decline`, and SPE `CRITICAL` + `ACT_NOW` escalation (`+30 sim-min` after `SPE_START`).
3. Confirm offline fallback: switch browser DevTools Network to **Offline**, reload `/`, verify service worker serves shell and `demo_main` progresses cleanly with `Offline mode — fully operational` badge.
