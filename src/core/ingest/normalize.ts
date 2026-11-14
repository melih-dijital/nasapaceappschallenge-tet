// Çerçeve doğrulama ve normalizasyon: Zod biçim, spo2 0–100, makullük, monoton zaman ve kopya bastırma (FAZ_03 §3.1).
import { TelemetryFrameSchema } from '../schema'
import type { MetricId, SimTimeMs, TelemetryFrame } from '../types'
import {
  checkFrame,
  getDefaultPlausibleRanges,
  type DataQualityEvent,
  type PlausibleRanges,
} from './plausibility'

export interface IngestBatchResult {
  accepted: TelemetryFrame[]
  dataQuality: DataQualityEvent[]
}

const MAX_SEEN_KEYS = 8192

export class IngestNormalizer {
  private readonly ranges: PlausibleRanges
  private readonly lastTByStream = new Map<string, SimTimeMs>()
  private readonly seenKeys = new Set<string>()
  private readonly seenOrder: string[] = []
  private eventSeq = 0

  constructor(ranges: PlausibleRanges = getDefaultPlausibleRanges()) {
    this.ranges = ranges
  }

  reset(): void {
    this.lastTByStream.clear()
    this.seenKeys.clear()
    this.seenOrder.length = 0
    this.eventSeq = 0
  }

  processBatch(rawFrames: readonly unknown[], fallbackT: SimTimeMs): IngestBatchResult {
    const accepted: TelemetryFrame[] = []
    const dataQuality: DataQualityEvent[] = []

    for (const raw of rawFrames) {
      const parsed = TelemetryFrameSchema.safeParse(raw)
      if (!parsed.success) {
        dataQuality.push({
          id: this.nextEventId('schema'),
          kind: 'SCHEMA_INVALID',
          t: fallbackT,
          detail: parsed.error.issues[0]?.message ?? 'Invalid TelemetryFrame schema',
        })
        continue
      }

      const normalized = normalizeSpo2(parsed.data)
      const plausibility = checkFrame(normalized, this.ranges)
      if (!plausibility.ok) {
        const firstIssue = plausibility.issues[0]
        const metricField: Partial<{ metric: MetricId }> =
          firstIssue &&
          firstIssue.metric !== 'protonFluxPfu' &&
          firstIssue.metric !== 't' &&
          firstIssue.metric !== 'day'
            ? { metric: firstIssue.metric }
            : {}

        dataQuality.push({
          id: this.nextEventId('plaus'),
          kind: 'PLAUSIBILITY_REJECTED',
          t: normalized.t,
          crewId: normalized.crewId,
          frameKind: normalized.kind,
          ...metricField,
          ...(firstIssue ? { value: firstIssue.value } : {}),
          detail: plausibility.issues
            .map((i) => `${i.metric}:${i.reason}(${i.value})`)
            .join(', '),
        })
        continue
      }

      const dupKey = `${normalized.crewId}|${normalized.kind}|${normalized.t}`
      if (this.seenKeys.has(dupKey)) {
        dataQuality.push({
          id: this.nextEventId('dup'),
          kind: 'DUPLICATE_FRAME',
          t: normalized.t,
          crewId: normalized.crewId,
          frameKind: normalized.kind,
          detail: `Duplicate frame ${dupKey}`,
        })
        continue
      }

      const streamKey = `${normalized.crewId}|${normalized.kind}`
      const prevT = this.lastTByStream.get(streamKey)
      if (prevT !== undefined && normalized.t < prevT) {
        dataQuality.push({
          id: this.nextEventId('mono'),
          kind: 'NON_MONOTONIC_TIME',
          t: normalized.t,
          crewId: normalized.crewId,
          frameKind: normalized.kind,
          detail: `Non-monotonic timestamp ${normalized.t} < ${prevT} for ${streamKey}`,
        })
        continue
      }

      this.lastTByStream.set(streamKey, normalized.t)
      this.recordSeenKey(dupKey)
      accepted.push(normalized)
    }

    return { accepted, dataQuality }
  }

  private recordSeenKey(key: string): void {
    this.seenKeys.add(key)
    this.seenOrder.push(key)
    if (this.seenOrder.length > MAX_SEEN_KEYS) {
      const oldest = this.seenOrder.shift()
      if (oldest !== undefined) {
        this.seenKeys.delete(oldest)
      }
    }
  }

  private nextEventId(prefix: string): string {
    this.eventSeq += 1
    return `dq-${prefix}-${this.eventSeq}`
  }
}

/**
 * SpO2 0–1 oran biçiminde geldiyse (0 < spo2 <= 1) 0–100 yüzdelik ölçeğe çevirir.
 * 0 veya > 100 değerlerine dokunmaz (plausibility tarafından yakalanır).
 */
export function normalizeSpo2(frame: TelemetryFrame): TelemetryFrame {
  if (frame.kind !== 'vitals') return frame
  if (frame.spo2 > 0 && frame.spo2 <= 1) {
    return {
      ...frame,
      spo2: Math.round(frame.spo2 * 10000) / 100,
    }
  }
  return frame
}
