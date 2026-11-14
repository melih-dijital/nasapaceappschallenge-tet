export { STATE_ACTION_MAP, suggestedActionsFor } from './actionMap'
export { AlertManager, type DetectionInputs, type StateHit } from './alertManager'
export {
  DETECTION_EXTRAS_SCRATCH_KEY,
  DetectionStage,
  type DetectionExtras,
} from './detectionStage'
export { DETECTION_I18N_KEYS } from './i18nKeys'
export { evaluateDoseL1, evaluateL1, type DoseInputs, type L1Context, type L1Hit, type L1Rule } from './l1Limits'
export { badDirectionZ, isVitalsCadence, L2Detector, zLevel, type L2Hit } from './l2Deviation'
export { L3Detector, type L3Hit, type L3Rule } from './l3Trend'
export {
  estimateState,
  estimateStates,
  explainState,
  stateSeverity,
  type ExplanationItem,
  type ExtraStateInput,
  type MetricZInput,
  type StateInputs,
} from './l4States'
export {
  isWarningPlus,
  loadDetectionParams,
  maxSeverity,
  minSeverity,
  severityRank,
  type DetectionParams,
} from './params'
