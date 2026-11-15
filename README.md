<div align="center">
  <img src="public/tether-logo.jpg" alt="Tether Logo" width="140" height="140" style="border-radius: 24px;" />

  # Tether

  ### Autonomous Deep-Space Crew Health Console & Latency-Aware Earth Link

  *“Most tools alert on a number. Tether tells the crew whether they can wait for Earth.”*

  [![NASA Space Apps 2026](https://img.shields.io/badge/NASA_Space_Apps-2026-0B3D91?style=flat-square)](https://www.spaceappschallenge.org/)
  [![TypeScript 6.0](https://img.shields.io/badge/TypeScript-6.0_Strict-3178C6?style=flat-square&logo=typescript&logoColor=white)](tsconfig.json)
  [![React 19 + Vite 8](https://img.shields.io/badge/React_19-Vite_8_PWA-00C2FF?style=flat-square&logo=react&logoColor=white)](vite.config.ts)
  [![Offline First](https://img.shields.io/badge/Offline--First-Web_Worker_%2B_IndexedDB-10B981?style=flat-square)](#offline-mode-pwa--production-preview)
  [![Validation](https://img.shields.io/badge/Synthetic_Benchmark-95.3%25_Strong_Recall-22C55E?style=flat-square)](docs/demo/validation-report.md)
</div>

---

> **Disclaimer:** **Tether** is a decision-support prototype driven by deterministic synthetic telemetry (`mulberry32` seeded scenarios). It is **not** a medical device and makes **no** claim of clinical or diagnostic accuracy. Every threshold and model parameter is explicitly tagged by verification status (`VERIFIED`, `PARTIAL`, `CONFLICTING`, `UNVERIFIED` / `DEMO_PARAMETER`).

---

## Why “Tether”?

On Low-Earth Orbit missions, astronauts are continuously tethered to flight surgeons on the ground with near-zero latency. On deep-space missions such as **Mars transit**, one-way light-time delay stretches from **3 to 22 minutes** (**6 to 44 minutes** round-trip signal propagation, plus ~15 minutes of ground review) alongside solar conjunction blackouts.

**Tether** reimagines that lifeline for deep space:
1. **Onboard Autonomy First:** When an acute event (such as a confirmed Solar Particle Event, cabin $\text{CO}_2$ spike, or $\text{SpO}_2$ drop) develops faster than the Earth round-trip window, the onboard engine immediately classifies the alert as `ACT_NOW`, issues procedural action cards, and adapts the crew's 24-hour schedule **without waiting for a ground reply**.
2. **Continuous Delayed Earth Mirror (`store-and-forward`):** Every 15 simulated minutes (`earth.downlinkBatchMin`), onboard telemetry is packaged, scrubbed of private journal/check-in notes, and transmitted across the simulated deep-space link. Mission Control views a true light-time-delayed **Ground Mirror** (`groundMirror`) that queues packets during communication blackouts and delivers them in order when link connectivity returns.

---

## Core Capabilities

| Capability | How Tether Works |
|---|---|
| **Latency-Aware Triage** | Compares each alert's `timeToHarmMin` against the live round-trip turnaround (`2 × oneWayDelay + groundProcessingMin`) to classify into `ACT_NOW`, `ACT_THEN_REPORT`, or `CAN_WAIT_FOR_EARTH`. |
| **Autonomous 24h Schedule Planner** | Pure rule-based planner (`src/core/decision/planner.ts`) resolves conflicts, protects sleep floors (`plan.sleep.minFractionOfBaseline`) and resistive exercise minimums, and automatically cancels high-exertion blocks to insert `SHELTER` or `REST` blocks during emergencies. |
| **Delayed Earth Mirror (`groundMirror` & `downlink`)** | Maintains a separate Earth-side snapshot updated strictly from `DELIVERED` uplink batches after `oneWayDelaySec` + 64 kbps serialization delay. During blackout, packets wait in `QUEUED` state while Earth View displays *"Link down · last data hh:mm"*. |
| **Personal 14-Day Sliding Baselines** | Tracks per-crew rolling median and scaled MAD ($\sigma_{\text{robust}} = 1.4826 \cdot \text{MAD}$) partitioned by 6-hour circadian blocks (`hr`) or radiation environment bins—no EWMA smoothing—protected by a **48-hour drift guard** when `WARNING+` alerts are active. |
| **Explainable 4-Layer Detection (`L1–L4`)** | **L1** absolute safety limits · **L2** personal z-score deviations with persistence gating · **L3** multi-day trends (daily CUSUM & Theil-Sen slopes) · **L4** normalized multi-metric state scores (`fatigue`, `stress`, `dehydration`, `sleep_debt`, `radiation_event`, `cardio_strain`, `mood_decline`) with full driver attribution (`Why?` drawer). |
| **Radiation & Indicative Bone Estimates** | Tracks cumulative career dose against the `600 mSv` NASA-STD-3001 limit, runs an SPE state machine (`IDLE → SUSPECTED → CONFIRMED → DECAYING`) against the `250 mSv` **design reference SPE protection target**, and computes indicative bone-loss estimates from resistive exercise adherence. |
| **Strict On-Device Privacy Boundary** | Crew daily check-ins, 60-second Psychomotor Vigilance Task (PVT) reaction tests, and private journal entries (`JournalEntry`) stay strictly on-device. Outbound packets undergo deep recursive sanitization (`stripForbiddenKeys`) to guarantee zero leakage of `journal` or raw check-in notes. |
| **Calm Spacecraft Console + Presenter Drawer** | High-contrast AA dark console (`#0B0E12` / `#12161C`, tabular monospace numbers, bilingual `EN`/`TR`, Web Audio alerts). Simulation playback controls stay tucked inside the **Presenter Controls** drawer (`Shift+P` or `?demo=1`). |

---

## Architecture & 7-Stage Pipeline

All simulation, baseline statistics, anomaly detection, schedule planning, and store-and-forward Earth Link modeling execute in pure TypeScript (`src/core/**` and `src/sim/**`, zero DOM dependencies) inside a dedicated Web Worker:

```text
[TelemetrySource: Seeded InProcessSimSource (autoStart 1×) / Optional Local WS]
        │
        ▼ (Web Worker: src/workers/sim.worker.ts · batched ≤ 10 Hz)
┌──────────────────────────────────────────────────────────────────────────────┐
│ 7-Stage Engine Pipeline (src/core/pipeline/)                                 │
│  1. IngestStage    → Zod schema check, SpO2 normalization, DataQualityTracker│
│  2. BufferStage    → Per-crew chronological ring buffers                     │
│  3. BaselineStage  → 14-day sliding median/MAD circadian bins + drift guard  │
│  4. ModulesStage   → Radiation accumulator, career % & SPE state machine     │
│  5. DetectionStage → L1–L4 detectors + AlertManager hysteresis & cooldown    │
│  6. DecisionStage  → Delay triage, action cards, 24h plan diff,              │
│                      15-min TELEMETRY_BATCH downlink & GroundMirror          │
│  7. PersistStage   → MemoryFrameStore (Node) / Dexie IndexedDB (Browser)     │
└──────────────────────────────────────────────────────────────────────────────┘
        │  postMessage (Zod-validated · CSP-safe z.config({ jitless: true }))
        ▼
[Zustand Stores + React 19 UI (/ , /alerts , /behavioral , /ground , /evidence , /validation)]
```

A separate Web Worker ([src/workers/validation.worker.ts](src/workers/validation.worker.ts)) and CLI runner ([scripts/validate.ts](scripts/validate.ts)) execute the multi-seed validation suite using the exact same `createDefaultEngine` factory.

---

## Quick Start

### Prerequisites
- **Node.js 20+** and `npm`

### 1. Install & Run Development Server

```powershell
npm install
npm run dev
```

- **Standard Console View:** `http://localhost:5173/` (automatically starts `demo_main` at `1×` speed; press **`Shift+P`** at any time to open the Presenter Controls drawer).
- **Presenter / Rehearsal Mode:** `http://localhost:5173/?demo=1` (opens Presenter Mode with keyboard shortcuts `D`, `1–4` bookmarks, `Space` play/pause, `R` reset, `E` Earth delay cycle, `?` help, and suppresses PWA update banners).

### 2. Production Build & Offline PWA Verification

Tether ships with a strict Content Security Policy ([vercel.json](vercel.json)) and precaches all application bundles, Web Workers, icons, and assets for 100% offline operation:

```powershell
npm run build
npm run preview
```

### 3. Quality Gate & Synthetic Validation Commands

```powershell
npm run check           # Full gate: evidence:build + calibration:build + typecheck + lint + test (52 files / 317 tests) + build + pwa:check
npm run validate        # Full 8-scenario deterministic benchmark (tuning seeds 1–5, report seeds 100–119)
npm run validate:quick  # Fast 3-seed validation smoke check (~9.5s)
```

### 4. Optional Local Ground Station (`ws`)

Not required for offline usage or static deployment. To test live WebSocket telemetry streaming locally in two terminals:

1. Terminal 1: `npm run dev`
2. Terminal 2: `npm run server` (listens on `ws://localhost:8787`; automatically falls back to the onboard simulator if disconnected).

---

## Evidence Registry & Provenance Policy

No clinical or engineering numbers are hardcoded in detector logic. All **131** parameters are authored in Markdown tables under [docs/sources/](docs/sources/) and compiled into [src/core/evidence/evidence.generated.json](src/core/evidence/evidence.generated.json):

- **`VERIFIED` (3):**
  - `rad.career.limit.msv` (`600 mSv` — NASA-STD-3001 Vol. 1 career effective dose limit)
  - `rad.iss.rate.msv_day` (`0.2–0.5 mSv/day` — NASA NTRS ISS dose rate)
  - `bone.loss.pct_month` (`1–1.5 %/month` — NASA HRP monthly proximal femur/spine loss rate)
- **`PARTIAL` (3):**
  - `rad.spe.limit.msv` (`250 mSv` — **design reference SPE protection target** for the Oct 1989 reference event; never labeled as an individual per-event limit)
  - `rad.gcr.design.free_space` (`1.3 mSv/day`)
  - `spo2.critical` (`90 %` — general clinical hypoxemia convention)
- **`CONFLICTING` (1):**
  - `rad.gcr.design.surface` (`0.8–0.9 mSv/day`)
- **`UNVERIFIED` / `DEMO_PARAMETER` (124):**
  - `noaa.s1.proton_flux.pfu` (`10 pfu`), `hct.flight.rise.pct` (`+10–12 %`), `earth.downlinkBatchMin` (`15 min`), and `121` explicitly tagged `DEMO_PARAMETER` internal weights, z-thresholds, persistence windows, and `timeToHarmMin` estimates ([docs/sources/demo-parameters.md](docs/sources/demo-parameters.md)).

---

## Synthetic Validation Benchmark

Evaluated across **8 curated mission scenarios** on **20 held-out report seeds (`100–119`)** ([docs/demo/validation-report.md](docs/demo/validation-report.md), fingerprint `fnv1a-b7dcb2979372397d`):

| Target Metric | Goal | Held-Out Report Result | Status |
|---|---|---|---|
| **Nominal `WARNING+` False Positives** | `<= 0.100 / crew-day` | **`0.025 / crew-day`** (`59` FP across `2,400` nominal crew-days) | PASS |
| **Strong-Event Recall** | `>= 90.0%` | **`95.3%`** (`305 TP` / `15 FN`) | PASS |
| **SPE Detection Latency (P90)** | `<= 60.0 sim-min` | **`15.0 sim-min`** (`100%` recall, `100%` `ACT_NOW` triage) | PASS |
| **Overfitting Check (Tuning `1–5` vs. Report `100–119`)** | `gap <= 15.0%` | **`-1.5%`** (Tuning `94.1%` vs. Report `95.6%`) | PASS |

### Per-Scenario Breakdown (Report Seeds `100–119`)

| Scenario | Strength | Runs | TP | FN | FP (`WARNING+`) | `ADVISORY` | Recall | Specificity | FP / crew-day | P90 Detect (min) | Triage Accuracy |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `nominal` | `NONE` | 20 | 0 | 0 | 59 | 1222 | — | 92.8% | 0.0246 | — | — |
| `solar_particle_event` | `STRONG` | 20 | 80 | 0 | 18 | 349 | 100.0% | 92.3% | 0.0321 | 15.0 | 100.0% |
| `sleep_debt` | `STRONG` | 20 | 73 | 7 | 32 | 638 | 91.3% | 77.9% | 0.0286 | 2879.0 | — |
| `isolation_low_mood` | `MODERATE` | 20 | 20 | 0 | 67 | 960 | 100.0% | 92.9% | 0.0381 | 10223.0 | — |
| `dehydration_co2` | `STRONG` | 20 | 18 | 2 | 105 | 563 | 90.0% | 71.1% | 0.1094 | 1439.0 | — |
| `comm_blackout` | `STRONG` | 20 | 19 | 1 | 20 | 466 | 95.0% | 91.6% | 0.0250 | 288.0 | — |
| `demo_main` | `STRONG` | 20 | 115 | 5 | 48 | 330 | 95.8% | 81.5% | 0.1000 | 1439.0 | 100.0% |
| `new_crew_member` | `NONE` | 20 | 0 | 0 | 0 | 305 | — | 100.0% | 0.0000 | — | — |

---

## Honest Limitations

1. **Synthetic Telemetry & Circularity Risk:** Both the telemetry streams and the detector rules were designed within the same project. High benchmark scores demonstrate internal algorithmic consistency across held-out random seeds, **not** clinical validation on real flight data.
2. **Not a Medical Device:** Outputs are procedural crew decision-support cues and schedule adjustments, not medical diagnoses.
3. **Indicative Bone-Loss Model:** Bone mineral density cannot be measured live onboard (DXA scans are pre-/post-flight); Tether's bone card explicitly labels its output as an indicative estimate from resistive exercise compliance.
4. **Cold-Start Baseline Guard:** Crew members with `< 7` days of backfill (`new_crew_member`) have baseline confidence `< 0.5`, deliberately capping L2/L4 anomaly alerts at `ADVISORY`.
5. **Advisory Noise Tracked Separately:** Unmatched `ADVISORY` notifications (`4,833` across `8,320` report crew-days) are reported in their own column rather than hidden or merged into `WARNING+` false positives.

---

## Repository Structure

```text
├── docs/
│   ├── sources/          # Markdown evidence sources (compiled to evidence.generated.json)
│   ├── demo/             # 60-90s demo script, validation report (JSON/MD), submission checklist
│   └── i18n-keys.md      # Canonical EN/TR translation key & DataQualityKind reference
├── public/               # Static assets (Tether logo & vector favicon)
├── scripts/              # Build-time compilers (evidence, calibration, PWA icons, validate CLI)
├── server/               # Optional local WebSocket ground-station simulator
├── src/
│   ├── core/             # Pure TS engine (types, schema, evidence, ingest, baseline,
│   │                     #   modules, detection, decision, earthlink, pipeline, validation)
│   ├── sim/              # Seeded PRNG (mulberry32), crew generator, 8 mission scenarios
│   ├── workers/          # sim.worker.ts, validation.worker.ts & Zod protocol handlers
│   ├── store/            # Zustand stores, min-max decimation, Worker/InProcess EngineClient
│   ├── pwa/              # Offline Service Worker registration & ?demo=1 prompt suppression
│   └── ui/               # React 19 console UI (Cockpit, Alerts, Behavioral, Earth View,
│                         #   Evidence, Validation, Presenter Controls, EN/TR i18n)
└── tests/                # 52 test files / 317 unit, integration, UI & WebSocket tests
```

---

## Türkçe Özet (Turkish Summary)

**Tether**, NASA Space Apps Challenge 2026 (*Create Health Monitoring Software for Astronauts on Space Missions*) için geliştirilmiş, **derin uzay iletişim gecikmesi altında çalışan otonom ve çevrimdışı (offline-first) mürettebat sağlık izleme ve karar destek konsoludur**.

- **Gecikme-Bilinçli Triyaj (`ACT_NOW | ACT_THEN_REPORT | CAN_WAIT_FOR_EARTH`):** Mars yolculuğundaki 3–22 dakikalık tek yön ışık gecikmesini (SPE sırasında 20 dk tek yön / ~55 dk gidiş-dönüş) hesaba katarak mürettebatın Dünya'dan yanıt bekleyip bekleyemeyeceğini belirler; yerel eylem kartlarını ve 24 saatlik görev planı değişikliklerini yer yanıtını beklemeden üretir.
- **Kesintisiz Gecikmeli Dünya Takibi (`groundMirror` & `downlink`):** Araçtaki tüm telemetri 15 sim-dakikada bir (`earth.downlinkBatchMin`) paketlenerek *store-and-forward* mimarisiyle Dünya'ya gönderilir. Özel günlük (`journal`) ve ham check-in notları derin taramayla cihazda tutulur. İletişim kesintisinde (`blackout`) paketler kuyrukta bekler; Dünya görünümü yalnızca Dünya'ya ulaşmış verileri çizer.
- **Açıklanabilir 4 Katmanlı Algılama (`L1–L4`) ve Kişisel Baseline:** Kara kutu yapay zekâ yerine 14 günlük kayan medyan/MAD baseline'ı, 48 saatlik *drift guard*, L1 mutlak sınırlar, L2 kalıcılık kapılı z-skoru, L3 CUSUM/Theil-Sen eğilimleri ve L4 çoklu metrik durum tahminleri kullanır.

---

## References & Attributions

- **NASA-STD-3001 Vol. 1** — *Space Flight Human-System Standard, Volume 1: Crew Health* & OCHMO Space Radiation Protection Technical Brief (`600 mSv` career limit; `250 mSv` October 1989 design reference SPE protection target).
- **NASA Human Research Program (HRP)** — [Risks & Hazards](https://www.nasa.gov/hrp/risks/) & [Risk of Spaceflight-Induced Bone Changes](https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/).
- **NASA NTRS (Simonsen et al., ASCEND)** — ISS radiation dose rates (`0.2–0.5 mSv/day`).
- **Canadian Space Agency (CSA)** — *Monitoring Radiation for Astronaut Health*.

## Team & License

- **Team:** **Team TET** — NASA Space Apps Challenge 2026
- **License:** MIT
