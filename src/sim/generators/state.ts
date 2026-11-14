// Üretici iç durumu (AR(1) geçmişi ve kümülatif uyku borcu) — saf veri, DOM yok.

export interface CrewSimState {
  hrNoise: number
  spo2Noise: number
  hrvNoise: number
  radNoise: number
  sleepDebtH: number
  dailyDev: {
    sleepDurationH: number
    sleepEfficiency: number
    midpointShiftMin: number
    exerciseMin: number
    resistiveMin: number
    hydrationL: number
    cabinCo2OffsetPpm: number
    stress: number
    mood: number
    motivation: number
    pvtMedianMs: number
  }
}

export interface GeneratorResult<TFrame, TState> {
  frame: TFrame
  nextState: TState
}

export function createInitialCrewState(): CrewSimState {
  return {
    hrNoise: 0,
    spo2Noise: 0,
    hrvNoise: 0,
    radNoise: 0,
    sleepDebtH: 0,
    dailyDev: {
      sleepDurationH: 0,
      sleepEfficiency: 0,
      midpointShiftMin: 0,
      exerciseMin: 0,
      resistiveMin: 0,
      hydrationL: 0,
      cabinCo2OffsetPpm: 0,
      stress: 0,
      mood: 0,
      motivation: 0,
      pvtMedianMs: 0,
    },
  }
}
