# Technical Documentation Rewrite Draft (`Astronot_Saglik_Kokpiti_Dokumantasyon.pdf` v2)

> **Purpose:** Replaces the legacy pre-kit documentation draft (`Astronot_Saglik_Kokpiti_Dokumantasyon.pdf`), which described an outdated Node/Python WebSocket backend hosted on Railway/Render (`/backend`, `/frontend`) and inaccurately claimed *"calibrated with NASA HRP numeric thresholds."*
> **Status:** Ready-to-review manuscript in Markdown for Team TET to export as the final submission PDF once live Vercel screenshots/URL are inserted.

---

## Old Documentation vs. New Architecture (Summary of Corrections)

| Topic | Legacy PDF Statement (Obsolete / Inaccurate) | New Verified Kit Reality (`PROJECT_MEMORY.md §3, §7`) |
|---|---|---|
| **Runtime & Hosting** | Node/Python backend server + Railway/Render deployment (`/backend`, `/frontend`) | **100% browser-resident, onboard-first static PWA** deployed on Vercel (`vercel.json` CSP); simulation + detection run inside browser Web Workers with IndexedDB (Dexie). Optional `server/` ws ground station is strictly for local two-terminal demo. |
| **Calibration Claims** | *"NASA HRP eşik değerleriyle kalibre"* | **Honest EvidenceRegistry:** NASA HRP risk pages are qualitative; numeric thresholds cite exact provenance (`NASA_STD` / `NASA_HRP` / `PEER_REVIEWED` / `CLINICAL_CONVENTION` / `DEMO_PARAMETER`). 123 of 130 parameters are explicitly tagged `UNVERIFIED` `DEMO_PARAMETER`. |
| **SPE Threshold Label** | Ambiguous radiation threshold wording | `600 mSv` career limit (`NASA-STD-3001 Vol.1`, `VERIFIED`); `250 mSv` labeled strictly **"design reference SPE protection target"** (`PARTIAL`, Oct 1989 design reference, not a personal per-event limit). |
| **Bone Health** | Treated like direct live sensor telemetry | Explicit **indicative estimate** computed from resistive exercise compliance vs. `1–1.5 %/month` (`NASA_HRP`), as DXA bone scans occur pre/post-flight. |
| **Validation Claims** | Generic accuracy claims without dataset provenance | Deterministic synthetic benchmark (`tuning 1–5` vs. `report 100–119`), separate `WARNING+` FP vs. `ADVISORY` noise reporting, parameter sensitivity, and embedded mandatory limitations. |

---

## Full Draft Manuscript (Ready for PDF Layout)

### 1. Problem Definition & Mission Context

Beyond Low Earth Orbit (LEO), crews face communication delays that turn real-time terrestrial telemedicine into an asymmetric, high-latency link. In Mars transit, one-way light time spans roughly `3` to `22` minutes (`6` to `44` minutes round-trip signal time alone, plus mission-control evaluation time). When an acute physiological, environmental, or Solar Particle Event (SPE) anomaly emerges during high latency or communications blackout, astronauts cannot safely pause operational decisions while waiting on ground telemetry loops.

NASA Human Research Program (HRP) hazards—specifically **Distance from Earth**, **Space Radiation**, **Isolation & Confinement**, and **Altered Gravity**—as well as Canadian Space Agency (CSA) monitoring priorities emphasize crew autonomy, longitudinal personal baselines, and explainable decision support.

---

### 2. Solution Overview

**Astro Health Cockpit** is an offline-capable, browser-native crew health decision-support prototype built for deep-space latency conditions.

- **Key Differentiator:** *"Most tools alert on a number. We tell the crew whether they can wait for Earth."*
- **Non-Medical Disclaimer:** This system is a deterministic decision-support prototype driven by seeded synthetic telemetry. It is **not** a medical device and makes **no** clinical or diagnostic claim.

---

### 3. Onboard-First Architecture (Zero Required Cloud Backend)

The application executes completely inside the client browser so network disconnection never interrupts monitoring:

```text
[TelemetrySource: InProcessSimSource (deterministic mulberry32 seed) | Optional local WS]
        │
        ▼ (Web Worker: sim.worker.ts — isolated from UI thread, batched <= 10 Hz)
[Engine 7-Stage Pipeline (Pure TypeScript, zero DOM/React)]
   1. IngestStage     → Zod schema validation, SpO2 normalization, sensor data-quality tracking
   2. BufferStage     → Per-crew chronological ring buffers
   3. BaselineStage   → 14-day sliding median/MAD by time-of-day/env bin + drift guard + confidence
   4. ModulesStage    → Radiation dose integration & SPE state machine (IDLE→SUSPECTED→CONFIRMED→DECAYING)
   5. DetectionStage  → L1 absolute limits · L2 personal z-score · L3 trend (CUSUM/Theil-Sen) · L4 state inference + AlertManager hysteresis
   6. DecisionStage   → Latency-aware triage (ACT_NOW / ACT_THEN_REPORT / CAN_WAIT_FOR_EARTH), action cards, 24h schedule diff, Earth Link store-and-forward queue
   7. PersistStage    → MemoryFrameStore (headless) or Dexie IndexedDB batch persistence (UI)
        │
        ▼ (Typed postMessage + Zod validation + CSP-safe z.config({ jitless: true }))
[Zustand Stores + React UI + Service Worker PWA (precache, offline reload, CSP headers)]
```

- **Secondary Worker (`validation.worker.ts`):** Runs multi-seed synthetic validation suites without blocking or interrupting live cockpit simulation.
- **Privacy Boundary:** Crew journal entries (`JournalEntry`) remain strictly on-device (`IndexedDB`/`localStorage` boundary) and are actively rejected/stripped from Earth Link telemetry packets (`journal`, `rawcheckin`, `diary`).

---

### 4. Detection, Personal Baselines & Latency-Aware Triage

1. **Personal Sliding Baseline (Zero EWMA):** Tracks a 14-day rolling `median` and scaled `MAD` (`1.4826 · MAD`) partitioned by 6-hour circadian blocks (`hr`) or radiation environment bins. When a crew member has an open `WARNING+` alert, **drift guard** freezes baseline updates for `48 h` so progressive deterioration never shifts the baseline. New crew members (`3`-day backfill) carry reduced confidence (`min(1, days / 14)`), capping L2/L4 severity at `ADVISORY` below `0.5` confidence.
2. **Explainable 4-Layer Rules (Zero Black-Box ML):** Every alert carries `whyKeys[]`, `evidenceIds[]`, contributing metrics with normalized weights, and `suggestedActionIds[]`.
3. **Latency-Aware Triage:** Round-trip response window combines `2 × oneWayDelaySec / 60 + groundProcessingMin` (default `15 min` ground review). If `timeToHarmMin <= roundTripMin` (or confirmed SPE `CRITICAL` radiation), triage emits **`ACT_NOW`** and updates the crew member's 24-hour schedule locally (e.g., sheltering and canceling strenuous exercise). Otherwise it emits **`ACT_THEN_REPORT`** or **`CAN_WAIT_FOR_EARTH`**.

---

### 5. Evidence Governance & Honest Provenance

All thresholds live in Markdown tables under `docs/sources/*.md` and compile deterministically into `src/core/evidence/evidence.generated.json` (`130` entries total):

- **`VERIFIED` (`3`):** `rad.career.limit.msv` (`600 mSv`, NASA-STD-3001 Vol.1), `rad.iss.rate.msv_day` (`0.2–0.5 mSv/day`, NTRS), `bone.loss.pct_month` (`1–1.5 %/month`, NASA HRP).
- **`PARTIAL` (`3`):** `rad.spe.limit.msv` (`250 mSv` design reference SPE protection target, Oct 1989 cumulative dose — not a personal event limit), `rad.gcr.design.free_space` (`1.3 mSv/day`), `spo2.critical` (`90 %`, clinical convention).
- **`CONFLICTING` (`1`):** `rad.gcr.design.surface` (`0.8–0.9 mSv/day`).
- **`UNVERIFIED` (`123`):** `noaa.s1.proton_flux.pfu` (`10 pfu`), `hct.flight.rise.pct` (`+10–12 %` secondary ref), and `121` internal `DEMO_PARAMETER` algorithmic weights, z-thresholds, persistence windows, and `timeToHarmMin` assumptions.

---

### 6. Synthetic Validation Summary (`docs/demo/validation-report.md`)

Executed via `npm run validate` against deterministic scenarios (`TUNING_SEEDS = 1..5`, `REPORT_SEEDS = 100..119`, fingerprint `fnv1a-0af1f79b4d5f4413`):

| Metric (20 Report Seeds · 160 Runs · 8,320 Crew-Days) | Result | Target | Status |
|---|---|---|---|
| Nominal False Positives (`WARNING+` / crew-day) | `0.025` (`59` events) | `<= 0.100` | `PASS` |
| Strong-Event Recall (`SPE`, `sleep_debt`, `dehydration_co2`, `comm_blackout`, `demo_main`) | `95.3%` (`305 TP`, `15 FN`) | `>= 90.0%` | `PASS` |
| Moderate-Event Recall (`isolation_low_mood`) | `100.0%` (`20 TP`, `0 FN`) | Reported | Reported |
| SPE Detection P90 Latency | `15.0 sim-min` | `<= 60.0 min` | `PASS` |
| Triage Accuracy (at first qualifying event) | `100.0%` | Reported | Reported |
| Unmatched `ADVISORY` Noise (excluded from FP) | `4,833` (`0.5809 / crew-day`) | Separate | Reported |
| Overfitting Check (Tuning `94.1%` vs. Report `95.6%`) | `gap = -1.5%` | `<= 15.0%` | `Within gap` |

**Mandatory Limitations:** Data are synthetic; injected events reflect scenario patterns authored by the same team as the detector (circularity risk); not validated against real astronaut flight telemetry; makes zero claim of clinical diagnostic sensitivity or specificity.
