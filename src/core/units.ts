// Zaman/birim dönüşümleri ve MS_PER_* sabitleri — TEK yer (PROJECT_MEMORY §6 "Birimler").
// Bunlar fiziksel/tasarım sabitleridir; algılama eşiği DEĞİLDİR (eşikler Evidence'tan okunur).

export const MS_PER_SEC = 1000
export const SEC_PER_MIN = 60
export const MIN_PER_HOUR = 60
export const HOURS_PER_DAY = 24

export const MS_PER_MIN = MS_PER_SEC * SEC_PER_MIN
export const MS_PER_HOUR = MS_PER_MIN * MIN_PER_HOUR
export const MS_PER_DAY = MS_PER_HOUR * HOURS_PER_DAY
export const MIN_PER_DAY = MIN_PER_HOUR * HOURS_PER_DAY

/** Vitals ve radyasyon çerçeve kadansı: her 15 simüle dakika (PROJECT_MEMORY §6). */
export const VITALS_INTERVAL_MIN = 15
export const RADIATION_INTERVAL_MIN = 15

export const secToMs = (sec: number): number => sec * MS_PER_SEC
export const msToSec = (ms: number): number => ms / MS_PER_SEC
export const minToMs = (min: number): number => min * MS_PER_MIN
export const msToMin = (ms: number): number => ms / MS_PER_MIN
export const hoursToMs = (hours: number): number => hours * MS_PER_HOUR
export const msToHours = (ms: number): number => ms / MS_PER_HOUR
export const daysToMs = (days: number): number => days * MS_PER_DAY
export const msToDays = (ms: number): number => ms / MS_PER_DAY
export const secToMin = (sec: number): number => sec / SEC_PER_MIN
export const minToSec = (min: number): number => min * SEC_PER_MIN
