# Astro Health Cockpit

**Autonomous, offline-capable crew health decision support under deep-space communication latency.**

> **Disclaimer:** Decision support prototype driven by deterministic synthetic telemetry (`mulberry32` seeded scenarios). **Not** a medical device and makes **no** claim of clinical or diagnostic accuracy.

*"Most tools alert on a number. We tell the crew whether they can wait for Earth."*

---

## Problem

On deep-space missions such as Mars transit, one-way light-time delay spans roughly **3 to 22 minutes** (**6 to 44 minutes** round-trip signal delay alone, plus ground mission-control review time) alongside planned or unplanned communications blackouts. Terrestrial telemetry dashboards that assume near-instant ground consultation leave astronauts without actionable guidance when acute physiological shifts, cabin environment drift, or Solar Particle Events (SPEs) occur faster than a round-trip message loop.

## Solution

**Astro Health Cockpit** is an **onboard-first static Progressive Web App (PWA)** built for NASA Space Apps Challenge 2026 (*Create Health Monitoring Software for Astronauts on Space Missions*). All simulation, baseline modeling, explainable 4-layer anomaly detection, latency-aware triage, and schedule planning execute inside browser Web Workers with IndexedDB persistence—requiring zero mandatory cloud backend and remaining operational when completely offline.

### Core Capabilities

- **Latency-Aware Triage (`ACT_NOW | ACT_THEN_REPORT | CAN_WAIT_FOR_EARTH`):** Evaluates whether an alert's `timeToHarmMin` fits within the current Earth round-trip delay (`2 × oneWayDelay + groundProcessingMin`), locally adapting the crew's 24-hour task schedule (e.g., shelving strenuous exercise and inserting shelter blocks during confirmed SPEs) while queuing outbound telemetry via a store-and-forward Earth Link simulator.
- **Personal Sliding-Window Baselines (No EWMA):** Tracks a 14-day rolling median and scaled MAD (`1.4826 · MAD`) partitioned by 6-hour circadian blocks (`hr`) or radiation environment bins, protected by a 48-hour **drift guard** when `WARNING+` alerts are open and a baseline confidence score (`min(1, days / 14)`) for new crew members.
- **Explainable 4-Layer Detection (`L1–L4`) + Alert Hysteresis:** Combines L1 absolute safety limits, L2 personal z-scores with persistence gating, L3 multi-day trends (daily CUSUM & Theil-Sen slopes), and L4 multi-metric state inference (`fatigue`, `stress`, `dehydration`, `sleep_debt`, `radiation_event`, `cardio_strain`, `mood_decline`)—zero black-box ML.
- **Radiation & Indicative Estimates:** Integrates cumulative career effective dose (`600 mSv` NASA-STD-3001 limit), tracks SPE `IDLE → SUSPECTED → CONFIRMED → DECAYING` states against a `250 mSv` **design reference SPE protection target**, and displays bone-loss estimates explicitly as indicative estimates from resistive exercise compliance.
- **Privacy Boundary for Behavioral Data:** Daily check-ins, 60-second PVT checks, passive proxies, and private crew journal entries (`JournalEntry`) stay strictly on-device and are stripped from all Earth Link packets.

---

## Architecture & Pipeline

Pure TypeScript engine (`src/core/**` and `src/sim/**`, zero DOM dependencies) running inside dedicated Web Workers:

```text
[TelemetrySource: InProcessSimSource (seeded) / Optional Local WS]
        │
        ▼ (Web Worker: src/workers/sim.worker.ts · batched ≤ 10 Hz)
┌─────────────────────────────────────────────────────────────────────────┐
│ 7-Stage Engine Pipeline (src/core/pipeline/)                            │
│  1. IngestStage    → Zod schema check, SpO2 normalization, sensor DQ    │
│  2. BufferStage    → Per-crew chronological ring buffers                │
│  3. BaselineStage  → 14-day sliding median/MAD bins + drift guard       │
│  4. ModulesStage   → Radiation dose accumulator & SPE state machine     │
│  5. DetectionStage → L1–L4 detectors + AlertManager hysteresis/cooldown │
│  6. DecisionStage  → Delay triage, action cards, 24h plan diff, EarthLink│
│  7. PersistStage   → MemoryFrameStore (Node) / Dexie IndexedDB (Browser)│
└─────────────────────────────────────────────────────────────────────────┘
        │  postMessage (Zod-validated · CSP-safe z.config({ jitless: true }))
        ▼
[Zustand Stores + React UI (/ , /evidence , /validation , /ground)]
```

A separate Web Worker ([validation.worker.ts](file:///c:/Users/geerv/Documents/nasapaceappschallenge-tet-main/nasapaceappschallenge-tet-main/src/workers/validation.worker.ts)) executes synthetic validation suites without interrupting live cockpit telemetry.

---

## How to Run

### Local Development (Node 20+)

Install dependencies first, then start the development server (two separate commands; PowerShell compatible):

```powershell
npm install
npm run dev
```

Demo tip: open `http://localhost:5173/?demo=1` to suppress PWA update prompts during rehearsal. Live URL (Vercel): *(to be added by team)*.

### Offline Mode (PWA) & Production Preview

The app runs wholly in the browser with no external network dependencies (`vercel.json` enforces strict CSP headers and SPA rewrites). To verify the production build and offline Service Worker behavior locally, run build and preview as separate commands:

```powershell
npm run build
npm run preview
```

### Verification & Synthetic Validation Commands

```powershell
npm run check           # Runs typecheck, lint, test, build (+ postbuild pwa:check)
npm run validate        # Full 8-scenario deterministic benchmark (tuning 1-5, report 100-119)
npm run validate:quick  # Fast 3-seed validation smoke check (~9.5s)
```

*(Note: on Windows multi-core runs, `npx vitest run --maxWorkers=2` avoids 5000ms CPU contention timeouts in heavy simulation tests.)*

### Optional Local Ground Station (`ws`)

Not needed for offline demo or static deployment (`server/` has no authentication or database and is for local testing only). Run in **two separate terminals**:

1. Terminal 1: `npm run dev`
2. Terminal 2: `npm run server` (env vars: `PORT` default `8787`, `SCENARIO`, `ALLOWED_ORIGINS`)

If the worker receives `INIT { source: 'ws', wsUrl: 'ws://localhost:8787' }`, frames stream from the local ground station and automatically fall back to the local simulator on disconnect.

---

## Data, Provenance Policy & Synthetic Benchmark

No thresholds are hardcoded in detection logic; all `130` parameters are authored in Markdown tables under `docs/sources/*.md` and compiled deterministically into `src/core/evidence/evidence.generated.json`:

- **`VERIFIED` (3):** `rad.career.limit.msv` (`600 mSv`, NASA-STD-3001 Vol.1), `rad.iss.rate.msv_day` (`0.2–0.5 mSv/day`, NASA NTRS), `bone.loss.pct_month` (`1–1.5 %/month`, NASA HRP).
- **`PARTIAL` (3):** `rad.spe.limit.msv` (`250 mSv` **design reference SPE protection target**, Oct 1989 design reference—not an individual per-event limit), `rad.gcr.design.free_space` (`1.3 mSv/day`), `spo2.critical` (`90 %`, general clinical convention).
- **`CONFLICTING` (1):** `rad.gcr.design.surface` (`0.8–0.9 mSv/day`).
- **`UNVERIFIED` (123):** `noaa.s1.proton_flux.pfu` (`10 pfu`), `hct.flight.rise.pct` (`+10–12 %`), plus `121` explicitly tagged `DEMO_PARAMETER` internal weights, z-thresholds, persistence counts, and `timeToHarmMin` estimates.

On our synthetic validation benchmark ([docs/demo/validation-report.md](file:///c:/Users/geerv/Documents/nasapaceappschallenge-tet-main/nasapaceappschallenge-tet-main/docs/demo/validation-report.md), fingerprint `fnv1a-0af1f79b4d5f4413`, 20 held-out report seeds `100–119`):
- Nominal `WARNING+` false positives: **0.025 / crew-day** (target `<= 0.100`)
- Strong-event recall: **95.3%** (`305 TP`, `15 FN`; target `>= 90.0%`)
- SPE detection P90 latency: **15.0 sim-min** (target `<= 60.0 min`)
- Overfitting gap (tuning `1–5` vs. report `100–119`): **-1.5%** (threshold `<= 15.0%`)

---

## Limitations (Honest Scope)

- **Synthetic Telemetry & Circularity Risk:** All telemetry streams and injected events are produced by our own simulator ([docs/demo/validation-report.md](file:///c:/Users/geerv/Documents/nasapaceappschallenge-tet-main/nasapaceappschallenge-tet-main/docs/demo/validation-report.md)). Metrics reflect internal rule consistency rather than independent validation.
- **Not a Medical Device:** Not validated on real astronaut flight data; outputs are non-clinical decision support cues.
- **Qualitative NASA HRP Scope:** NASA HRP risk pages provide qualitative hazard context (Distance from Earth, Radiation, Isolation, Altered Gravity) rather than numeric HR/SpO2/sleep thresholds.
- **Bone Loss Estimate:** Displayed bone density change is an indicative estimate derived from exercise compliance against HRP reference rates, not live DXA measurement.
- **Cold-Start Baseline:** New crew members (`new_crew_member` 3-day backfill) have confidence `< 0.5`, deliberately capping L2/L4 alerts at `ADVISORY`.
- **Separate Advisory Noise:** Unmatched `ADVISORY` notifications (`4,833` across `8,320` report crew-days, `0.5809 / crew-day`) are tracked separately from `WARNING+` false positives.

---

## References & Attributions

- **NASA-STD-3001 Vol. 1** — Crew Health & Space Radiation Protection Technical Brief (OCHMO): `600 mSv` career limit; `250 mSv` October 1989 design reference SPE protection target.
- **NASA Human Research Program (HRP)** — [Risks & Hazards](https://www.nasa.gov/hrp/risks/) & [Spaceflight-Induced Bone Changes](https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/).
- **NASA NTRS (ASCEND, Simonsen)** — ISS radiation dose rates (`0.2–0.5 mSv/day`).
- **Canadian Space Agency (CSA)** — *Monitoring Radiation for Astronaut Health* (CANS / ISS neutron context; reference archive in `docs/sources/_csa-radiation-data.md`).

## AI Usage Disclosure

- **AI Tools Used:** Claude (Anthropic) / AI coding assistants were used to help draft architecture specifications, TypeScript implementation boilerplate, test scaffolding, and technical documentation, with all provenance rules, threshold classifications, and submission materials reviewed and directed by **Team TET**.

## License & Team

- **License:** Open-source MIT *(final `LICENSE` file to be added to root prior to public repository freeze)*.
- **Team:** **Team TET** (3-member hackathon team, NASA Space Apps Challenge 2026).
