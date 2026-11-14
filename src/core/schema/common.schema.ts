import { z } from 'zod'
import { METRIC_IDS } from '../types/metric'

/**
 * Sonlu sayı. Zod 4'te z.number() NaN ve ±Infinity'yi zaten reddeder (`.finite()` artık no-op);
 * tek bir yardımcıdan geçiyoruz ki niyet açık olsun. Aralık (plausibility) kontrolü burada YOK — Faz 3.
 */
export const finite = () => z.number()

export const SimTimeMsSchema = finite()
export const CrewIdSchema = z.string().min(1)
export const MetricIdSchema = z.enum(METRIC_IDS)
