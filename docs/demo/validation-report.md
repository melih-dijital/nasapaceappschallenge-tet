# Validation Report — Astro Health Cockpit (Synthetic Benchmark)

> **Methodology Notice:** This report measures internal software consistency and rule-trigger behavior on deterministic synthetic scenarios. It is **not** clinical validation and makes **no** claim of medical diagnostic accuracy.

## Metadata & Reproducibility

| Field | Value |
|---|---|
| Parameter Version | `demo-parameters-v1` |
| Evidence Fingerprint (FNV-1a DEMO) | `fnv1a-b7dcb2979372397d` |
| Execution Mode | full |
| Tuning Seeds | `[1, 2, 3, 4, 5]` |
| Report Seeds | `[100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119]` |
| Engine Batch Step | 6 sim-hours |

## Target Evaluation (Report Seed Set)

| Target Metric | Actual | Threshold | Status |
|---|---|---|---|
| `nominalFpPerCrewDay` | 0.025 | <= 0.100 | ✅ PASS |
| `strongRecall` | 95.3% | >= 90.0% | ✅ PASS |
| `speDetectP90Min` | 15.0 | <= 60.0 | ✅ PASS |

## Aggregate Summary & Seed-Set Split (Tuning vs Report)

| Seed Set | Runs | Crew-Days | TP | FN | WARNING+ FP | ADVISORY Noise (excl. FP) | Recall | Precision | Specificity | Strong Recall | Moderate Recall | SPE Detect P90 (min) | Triage Accuracy |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| tuning (5 seeds) | 40 | 2080 | 80 | 5 | 91 | 1196 | 94.1% | 46.8% | 88.8% | 93.8% | 100.0% | 15.0 | 100.0% |
| report (20 seeds) | 160 | 8320 | 325 | 15 | 349 | 4833 | 95.6% | 48.2% | 88.4% | 95.3% | 100.0% | 15.0 | 100.0% |

**Overfitting Check:** Tuning Recall = 94.1%, Report Recall = 95.6%, Gap = -1.5% (Threshold <= 15.0%) → **✅ Within gap**

## Scenario Breakdown (Report Seeds)

| Scenario | Strength | Runs | TP | FN | WARNING+ FP | ADVISORY Noise | Recall | Precision | Specificity | FP / Crew-Day | Median Delay (min) | P90 Delay (min) | Triage Acc | Nominal Alert-Free Days |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `nominal` | NONE | 20 | 0 | 0 | 59 | 1222 | — | 0.0% | 92.8% | 0.0246 | — | — | — | 76.8% |
| `solar_particle_event` | STRONG | 20 | 80 | 0 | 18 | 349 | 100.0% | 81.6% | 92.3% | 0.0321 | 15.0 | 15.0 | 100.0% | — |
| `sleep_debt` | STRONG | 20 | 73 | 7 | 32 | 638 | 91.3% | 69.5% | 77.9% | 0.0286 | 1439.0 | 2879.0 | — | — |
| `isolation_low_mood` | MODERATE | 20 | 20 | 0 | 67 | 960 | 100.0% | 23.0% | 92.9% | 0.0381 | 7199.0 | 10223.0 | — | — |
| `dehydration_co2` | STRONG | 20 | 18 | 2 | 105 | 563 | 90.0% | 14.6% | 71.1% | 0.1094 | 1439.0 | 1439.0 | — | — |
| `comm_blackout` | STRONG | 20 | 19 | 1 | 20 | 466 | 95.0% | 48.7% | 91.6% | 0.0250 | 45.0 | 288.0 | — | — |
| `demo_main` | STRONG | 20 | 115 | 5 | 48 | 330 | 95.8% | 70.6% | 81.5% | 0.1000 | 15.0 | 1439.0 | 100.0% | — |
| `new_crew_member` | NONE | 20 | 0 | 0 | 0 | 305 | — | — | 100.0% | 0.0000 | — | — | — | — |

## False Positive vs Advisory Separation

| Alert Category | Total Count | Rate per Crew-Day | Included in FP / Specificity? |
|---|---|---|---|
| Unmatched WARNING / CRITICAL (FP) | 349 | 0.0419 | Yes |
| Unmatched ADVISORY (Informational Noise) | 4833 | 0.5809 | No (reported separately) |

## Parameter Sensitivity Analysis (Temporary Overrides)

| Parameter | Variation | Value | TP | FN | WARNING+ FP | Recall | FP / Crew-Day | ADVISORY / Crew-Day |
|---|---|---|---|---|---|---|---|---|
| `det.z.warning` | -20% | 2.4 | 32 | 2 | 95 | 94.1% | 0.1142 | 0.5240 |
| `det.z.warning` | base | 3 | 32 | 2 | 36 | 94.1% | 0.0433 | 0.5889 |
| `det.z.warning` | +20% | 3.6 | 32 | 2 | 15 | 94.1% | 0.0180 | 0.6106 |
| `det.persist.minFrames.vitals` | -20% | 3 | 29 | 5 | 115 | 85.3% | 0.1382 | 0.9856 |
| `det.persist.minFrames.vitals` | base | 4 | 32 | 2 | 36 | 94.1% | 0.0433 | 0.5889 |
| `det.persist.minFrames.vitals` | +20% | 5 | 32 | 2 | 35 | 94.1% | 0.0421 | 0.3558 |

## Limitations (Mandatory)

- Veriler sentetik; olaylar simülatörün enjekte ettiği örüntülerdir; algılayıcı ve simülatör aynı takım tarafından yazılmıştır (döngüsellik riski); gerçek astronot verisiyle doğrulanmamıştır; tıbbi performans iddiası yoktur.
- Synthetic telemetry only: injected anomalies reflect scripted scenario patterns written by the same team as the detector (circularity risk); not validated on real astronaut flight data and makes no claim of medical diagnostic performance.
- Nearly all detection, baseline, and triage thresholds carry DEMO_PARAMETER (UNVERIFIED) provenance; targets and scores measure internal software consistency rather than clinical sensitivity/specificity.

## Scoring Assumptions

- Backfill defaults to 14 sim-days (3 days for new_crew_member) and live runs use fixed 6 sim-hour Engine ingestion batches for batch-size determinism.
- True Positive rule (FAZ_08 §3.2): alert must reach >= minSeverity within [exp.fromT, exp.toT] (firstSeenT inside window); Earth Delay class is captured at that first qualifying event.
- False Positives count unmatched WARNING/CRITICAL alert episodes per scenario; unmatched ADVISORY alerts are isolated into advisoryCount and never mixed into FP or specificity.
- Specificity measures the fraction of event-free crew-days without an active WARNING/CRITICAL alert across nominal and non-event crew-days of other scenarios.
- Strong event scenarios: solar_particle_event, sleep_debt, dehydration_co2, comm_blackout, demo_main; moderate event scenario: isolation_low_mood; baseline-only: nominal, new_crew_member.
