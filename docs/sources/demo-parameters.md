---
id: demo-parameters
title: DEMO parametreleri — kaynağı olmayan algılama/baseline/earthlink eşikleri
url: —
sourceType: DEMO_PARAMETER
accessedAt: 2026-11-14
owner: Kişi B (FAZ_01 başlangıç değerleri)
---

## Özet
Kaynağı olmayan tüm eşik ve parametreler. Hepsi DEMO_PARAMETER ve UNVERIFIED'dir; NASA veya klinik limit olarak sunulmaz. Ayar yalnızca bu dosyada ve yalnızca ayar seed'leriyle (1–5) yapılır (PROJECT_MEMORY §13).

## Değerler
| evidenceId | metric | value | unit | status | scope | note |
|---|---|---|---|---|---|---|
| det.z.advisory | demo | 2.0 | z | UNVERIFIED | detection.L2 | |
| det.z.warning | demo | 3.0 | z | UNVERIFIED | detection.L2 | |
| det.z.critical | demo | 4.0 | z | UNVERIFIED | detection.L2 | |
| det.persist.minFrames.vitals | demo | 4 | frame | UNVERIFIED | detection.L2 | vitals 15 sim-dk → 1 saat |
| det.persist.minFrames.daily | demo | 1 | gün | UNVERIFIED | detection.L2 | günlük metrikler |
| det.cusum.k | demo | 0.5 | z | UNVERIFIED | detection.L3 | |
| det.cusum.h | demo | 4.0 | z | UNVERIFIED | detection.L3 | |
| det.trend.sleep.minDays | demo | 3 | gün | UNVERIFIED | detection.L3 | AstroHealth'in "3 gün <6 sa uyku" fikrinden esinli |
| det.trend.sleep.hoursBelow | demo | 6.0 | h | UNVERIFIED | detection.L3 | AstroHealth'in "3 gün <6 sa uyku" fikrinden esinli |
| det.trend.exercise.minDays | demo | 2 | gün | UNVERIFIED | detection.L3 | |
| det.trend.exercise.minutesBelow | demo | 30 | dk | UNVERIFIED | detection.L3 | |
| det.theilSen.windowDays | demo | 7 | gün | UNVERIFIED | detection.L3 | |
| det.theilSen.minSameSign | demo | 5 | nokta | UNVERIFIED | detection.L3 | 7 noktanın en az kaçı aynı yönde |
| det.state.sigmoid.k | demo | 6 | — | UNVERIFIED | detection.L4 | |
| det.state.sigmoid.bias | demo | 0.5 | — | UNVERIFIED | detection.L4 | |
| det.state.score.advisory | demo | 0.5 | — | UNVERIFIED | detection.L4 | |
| det.state.score.warning | demo | 0.7 | — | UNVERIFIED | detection.L4 | |
| det.state.score.critical | demo | 0.9 | — | UNVERIFIED | detection.L4 | |
| det.confidence.cap.threshold | demo | 0.5 | — | UNVERIFIED | detection | baseline güveni bunun altındaysa severity en fazla ADVISORY |
| det.cooldownMin | demo | 120 | sim-dk | UNVERIFIED | detection.alerts | |
| alert.recentResolvedHours | demo | 24 | sim-saat | UNVERIFIED | detection.alerts | snapshot'ta tutulan çözülmüş uyarı süresi |
| baseline.window.days.target | demo | 14 | gün | UNVERIFIED | baseline | |
| baseline.window.days.min | demo | 3 | gün | UNVERIFIED | baseline | altında baseline=null; 3–6 gün: var ama güven<0.5 |
| baseline.sparseBin.minSamples | demo | 8 | örnek | UNVERIFIED | baseline | |
| baseline.sparseBin.confidenceFactor | demo | 0.5 | çarpan | UNVERIFIED | baseline | |
| baseline.guard.hours | demo | 48 | saat | UNVERIFIED | baseline | drift koruması |
| baseline.hrBlockHours | demo | 6 | saat | UNVERIFIED | baseline | |
| minScale.hr | demo | 3 | bpm | UNVERIFIED | baseline.minScale | |
| minScale.spo2 | demo | 0.5 | % | UNVERIFIED | baseline.minScale | |
| minScale.hrv | demo | 5 | ms | UNVERIFIED | baseline.minScale | |
| minScale.sleep.durationH | demo | 0.5 | h | UNVERIFIED | baseline.minScale | |
| minScale.sleep.efficiency | demo | 0.04 | oran | UNVERIFIED | baseline.minScale | |
| minScale.sleep.midpointShiftMin | demo | 20 | dk | UNVERIFIED | baseline.minScale | |
| minScale.activity.exerciseMin | demo | 10 | dk | UNVERIFIED | baseline.minScale | |
| minScale.activity.resistiveMin | demo | 8 | dk | UNVERIFIED | baseline.minScale | |
| minScale.hydrationL | demo | 0.25 | L | UNVERIFIED | baseline.minScale | |
| minScale.cabinCo2ppm | demo | 100 | ppm | UNVERIFIED | baseline.minScale | |
| minScale.mood.stress | demo | 0.8 | puan | UNVERIFIED | baseline.minScale | |
| minScale.mood.mood | demo | 0.8 | puan | UNVERIFIED | baseline.minScale | |
| minScale.mood.motivation | demo | 0.8 | puan | UNVERIFIED | baseline.minScale | |
| minScale.pvt.medianMs | demo | 15 | ms | UNVERIFIED | baseline.minScale | |
| minScale.pvt.lapses | demo | 1 | adet | UNVERIFIED | baseline.minScale | |
| minScale.rad.doseRateMsvDay | demo | 0.03 | mSv/gün | UNVERIFIED | baseline.minScale | |
| buffer.daily.days | demo | 7 | gün | UNVERIFIED | engine.buffer | |
| buffer.vitals.hours | demo | 48 | saat | UNVERIFIED | engine.buffer | |
| sim.secondsPerSimDay | demo | 20 | s | UNVERIFIED | sim | 1× hızda 1 sim-gün kaç gerçek saniye |
| sim.speed.min | demo | 0.25 | × | UNVERIFIED | sim | |
| sim.speed.max | demo | 50 | × | UNVERIFIED | sim | |
| rad.spe.detect.ratio | demo | 3.0 | oran | UNVERIFIED | modules.radiation | baseline'a göre |
| rad.spe.detect.minFrames | demo | 2 | frame | UNVERIFIED | modules.radiation | |
| rad.spe.decay.ratio | demo | 1.5 | oran | UNVERIFIED | modules.radiation | |
| rad.spe.warn.fraction | demo | 0.5 | oran | UNVERIFIED | modules.radiation | olay dozu / rad.spe.limit.msv |
| rad.spe.critical.fraction | demo | 0.8 | oran | UNVERIFIED | modules.radiation | olay dozu / rad.spe.limit.msv |
| rad.career.warn.fraction | demo | 0.5 | oran | UNVERIFIED | modules.radiation | kariyer dozu / rad.career.limit.msv |
| rad.career.critical.fraction | demo | 0.8 | oran | UNVERIFIED | modules.radiation | kariyer dozu / rad.career.limit.msv |
| rad.projection.windowDays | demo | 7 | gün | UNVERIFIED | modules.radiation | |
| rad.projection.defaultMissionDays | demo | 30 | gün | UNVERIFIED | modules.radiation | senaryoda durationDays yoksa |
| bone.estimate.efficacy | demo | 0.5 | oran | UNVERIFIED | modules.cardio | kemik kaybı TAHMİNİ; canlı ölçüm değil |
| sleep.debt.decay | demo | 0.9 | /gün | UNVERIFIED | modules.sleep | |
| sleep.debt.criticalH | demo | 8 | h | UNVERIFIED | modules.sleep | |
| sleep.regularity.windowDays | demo | 7 | gün | UNVERIFIED | modules.sleep | |
| sleep.regularity.scaleMin | demo | 60 | dk | UNVERIFIED | modules.sleep | MAD→0-1 ölçek |
| pvt.lapse.thresholdMs | demo | 500 | ms | UNVERIFIED | modules.behavioral | PVT-benzeri kısa test; resmi PVT-B değil |
| behavior.windowDays | demo | 7 | gün | UNVERIFIED | modules.behavioral | uyum/eğim pencereleri |
| limit.cabinCo2ppm.warning | demo | 4000 | ppm | UNVERIFIED | detection.L1 | NASA limiti gibi sunulmaz; takım birincil kaynağı bulursa md güncellenir |
| earth.timeToHarmMin.radiation_event | demo | 30 | dk | UNVERIFIED | decision.triage | |
| earth.timeToHarmMin.spo2_low | demo | 10 | dk | UNVERIFIED | decision.triage | |
| earth.timeToHarmMin.cardio_strain | demo | 60 | dk | UNVERIFIED | decision.triage | |
| earth.timeToHarmMin.fatigue | demo | 720 | dk | UNVERIFIED | decision.triage | |
| earth.timeToHarmMin.stress | demo | 1440 | dk | UNVERIFIED | decision.triage | |
| earth.timeToHarmMin.dehydration | demo | 480 | dk | UNVERIFIED | decision.triage | |
| earth.timeToHarmMin.sleep_debt | demo | 4320 | dk | UNVERIFIED | decision.triage | |
| earth.timeToHarmMin.mood_decline | demo | 10080 | dk | UNVERIFIED | decision.triage | |
| earth.timeToHarmMin.co2_high | demo | 120 | dk | UNVERIFIED | decision.triage | |
| earth.timeToHarmMin.career_dose | demo | 10080 | dk | UNVERIFIED | decision.triage | |
| earth.oneWayDelaySec.moon | demo | 1.3 | s | UNVERIFIED | earthlink | genel bilgi (PROJECT_MEMORY §9) |
| earth.oneWayDelaySec.mars_min | demo | 180 | s | UNVERIFIED | earthlink | genel bilgi (PROJECT_MEMORY §9) |
| earth.oneWayDelaySec.mars_max | demo | 1320 | s | UNVERIFIED | earthlink | genel bilgi (PROJECT_MEMORY §9) |
| earth.groundProcessingMin | demo | 15 | dk | UNVERIFIED | earthlink | gidiş-dönüşe eklenen yer ekibi işlem süresi |
| earth.uplink.kbps | demo | 64 | kbps | UNVERIFIED | earthlink | |
| earth.outbox.capacity | demo | 200 | mesaj | UNVERIFIED | earthlink | |
| plan.sleep.durationH | demo | 8 | h | UNVERIFIED | decision.planner | |
| plan.rest.durationMin | demo | 45 | dk | UNVERIFIED | decision.planner | |
| plan.sleepShiftMin | demo | 30 | dk | UNVERIFIED | decision.planner | |
| plan.sleep.minFractionOfBaseline | demo | 0.9 | oran | UNVERIFIED | decision.planner | |
| plan.hydrate.extraBlocks | demo | 2 | blok | UNVERIFIED | decision.planner | |
| hydration.max.L | demo | 4.0 | L | UNVERIFIED | decision.planner | su hedefi üst sınırı |
| val.quickSeeds | demo | 3 | seed | UNVERIFIED | validation | validate:quick |
| val.overfit.recallGap | demo | 0.15 | oran | UNVERIFIED | validation | |
| val.target.nominalFpPerCrewDay | demo | 0.1 | alarm/kişi-gün | UNVERIFIED | validation | WARNING+ |
| val.target.strongRecall | demo | 0.9 | oran | UNVERIFIED | validation | |
| val.target.speDetectP90Min | demo | 60 | sim-dk | UNVERIFIED | validation | |
| val.sensitivity.pct | demo | 20 | % | UNVERIFIED | validation | |
| state.stress.w.trendSlope | demo | 0.10 | ağırlık | UNVERIFIED | detection.L4.weights | ek katkı ağırlığı; "ağırlık toplamı 1" testine DAHİL DEĞİL |
| state.mood_decline.w.trendSlope | demo | 0.10 | ağırlık | UNVERIFIED | detection.L4.weights | ek katkı ağırlığı; "ağırlık toplamı 1" testine DAHİL DEĞİL; Faz 6'da L4'e eklenir ve toplam yeniden normalize edilir |
| state.fatigue.w.sleep.durationH | demo | 0.30 | ağırlık | UNVERIFIED | detection.L4.weights | |
| state.fatigue.w.sleep.efficiency | demo | 0.10 | ağırlık | UNVERIFIED | detection.L4.weights | |
| state.fatigue.w.pvt.medianMs | demo | 0.20 | ağırlık | UNVERIFIED | detection.L4.weights | |
| state.fatigue.w.pvt.lapses | demo | 0.20 | ağırlık | UNVERIFIED | detection.L4.weights | |
| state.fatigue.w.hr | demo | 0.05 | ağırlık | UNVERIFIED | detection.L4.weights | |
| state.fatigue.w.hrv | demo | 0.05 | ağırlık | UNVERIFIED | detection.L4.weights | |
| state.fatigue.w.mood.motivation | demo | 0.10 | ağırlık | UNVERIFIED | detection.L4.weights | |
| state.stress.w.mood.stress | demo | 0.40 | ağırlık | UNVERIFIED | detection.L4.weights | |
| state.stress.w.hrv | demo | 0.20 | ağırlık | UNVERIFIED | detection.L4.weights | |
| state.stress.w.hr | demo | 0.15 | ağırlık | UNVERIFIED | detection.L4.weights | |
| state.stress.w.sleep.efficiency | demo | 0.10 | ağırlık | UNVERIFIED | detection.L4.weights | |
| state.stress.w.pvt.lapses | demo | 0.15 | ağırlık | UNVERIFIED | detection.L4.weights | |
| state.dehydration.w.hydrationL | demo | 0.55 | ağırlık | UNVERIFIED | detection.L4.weights | |
| state.dehydration.w.hr | demo | 0.25 | ağırlık | UNVERIFIED | detection.L4.weights | |
| state.dehydration.w.hrv | demo | 0.20 | ağırlık | UNVERIFIED | detection.L4.weights | |
| state.sleep_debt.w.sleep.durationH | demo | 0.60 | ağırlık | UNVERIFIED | detection.L4.weights | |
| state.sleep_debt.w.sleep.midpointShiftMin | demo | 0.40 | ağırlık | UNVERIFIED | detection.L4.weights | |
| state.radiation_event.w.rad.doseRateMsvDay | demo | 1.0 | ağırlık | UNVERIFIED | detection.L4.weights | |
| state.cardio_strain.w.hr | demo | 0.40 | ağırlık | UNVERIFIED | detection.L4.weights | |
| state.cardio_strain.w.hrv | demo | 0.30 | ağırlık | UNVERIFIED | detection.L4.weights | |
| state.cardio_strain.w.spo2 | demo | 0.20 | ağırlık | UNVERIFIED | detection.L4.weights | |
| state.cardio_strain.w.activity.resistiveMin | demo | 0.10 | ağırlık | UNVERIFIED | detection.L4.weights | |
| state.mood_decline.w.mood.mood | demo | 0.40 | ağırlık | UNVERIFIED | detection.L4.weights | |
| state.mood_decline.w.mood.motivation | demo | 0.25 | ağırlık | UNVERIFIED | detection.L4.weights | |
| state.mood_decline.w.mood.stress | demo | 0.20 | ağırlık | UNVERIFIED | detection.L4.weights | |
| state.mood_decline.w.activity.exerciseMin | demo | 0.15 | ağırlık | UNVERIFIED | detection.L4.weights | |

## Sınırlamalar / dikkat
- Bu değerlerin hiçbiri NASA veya klinik kaynaktan değildir; UI'da "DEMO — doğrulanmadı" etiketiyle gösterilir.
- Durum ağırlıkları her durumda toplam 1.0'dır; `trendSlope` ek katkıları bu toplama dahil değildir.

## Kodda nerede kullanılacak (opsiyonel)
- Faz 2 simülatör hızı, Faz 3 tamponlar, Faz 4 baseline, Faz 5 algılama, Faz 6 modüller, Faz 7 planlayıcı ve triyaj, Faz 8 doğrulama hedefleri.
