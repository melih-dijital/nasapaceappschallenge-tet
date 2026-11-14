// Faz 5 algılama motorunun ürettiği i18n anahtarları ve parametreleri (metinler Faz 9 `en`/`tr` sözlüğünde).
// FAZ_05 §6 bunları docs/i18n-keys.md'ye istiyor; docs/** Kişi C'nin klasörü olduğu için liste burada tutulur
// ve docs/i18n-keys.md'ye aktarılmalıdır (PROJECT_MEMORY §14).
import { METRIC_IDS, STATE_IDS } from '../types'
import type { L1Rule } from './l1Limits'

const L1_RULES: readonly L1Rule[] = ['SPO2_LOW', 'CO2_HIGH', 'CAREER_DOSE', 'SPE_DOSE']

export interface I18nKeySpec {
  key: string
  params: readonly string[]
  note?: string
}

export const DETECTION_I18N_KEYS: readonly I18nKeySpec[] = [
  ...STATE_IDS.map((s) => ({ key: `alert.${s}.title`, params: [] })),
  ...L1_RULES.map((r) => ({ key: `alert.l1.${r}.title`, params: [] })),
  ...L1_RULES.map((r) => ({
    key: `why.l1.${r}`,
    params: ['value', 'threshold', 'verified'],
    note: 'verified=0 ise "doğrulanmadı" etiketi; SPE_DOSE eşiği "design reference SPE protection target" (limit değil)',
  })),
  {
    key: 'alert.metric.cabinCo2ppm.title',
    params: [],
    note: 'durum eşlemesi olmayan metrik uyarısı (L2/L3)',
  },
  { key: 'why.l2.deviation', params: ['metric', 'z', 'persistFrames'] },
  { key: 'why.l3.consecutive', params: ['metric', 'days', 'value', 'below'] },
  { key: 'why.l3.cusum', params: ['metric', 's', 'h'] },
  { key: 'why.l3.theil_sen', params: ['metric', 'slopePerDay', 'sameSign', 'windowDays', 'rise'] },
  { key: 'why.baseline.lowConfidence', params: ['confidence'] },
  { key: 'why.state.score', params: ['state', 'score', 'confidence'] },
  { key: 'why.state.contributor', params: ['metric', 'z', 'weightPct', 'contribution'] },
  ...METRIC_IDS.map((m) => ({ key: `metric.${m}`, params: [], note: 'METRIC_META.labelKey' })),
]
