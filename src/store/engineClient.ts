// EngineClient sözleşmesi (Faz 1: yalnızca arayüz). Gerçek uygulama Faz 3'te bu dosyaya eklenir
// (worker'ı oluşturur, çökerse yeniden başlatır). Faz 1'deki mock (src/ui/mock/mockEngine.ts) aynı arayüzü uygular,
// böylece UI gerçek motora değişiklik olmadan geçer. Store'lara yalnızca EngineClient yazar.
import type { UiToWorkerMessage, WorkerToUiMessage } from '../workers/protocol'

export type EngineListener = (message: WorkerToUiMessage) => void

export interface EngineClient {
  send(message: UiToWorkerMessage): void
  /** Dönen fonksiyon aboneliği kaldırır. */
  subscribe(listener: EngineListener): () => void
  dispose(): void
}
