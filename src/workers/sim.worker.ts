// Web Worker giriş noktası (FAZ_03 §3.4). Gerçek setInterval yalnızca burada enjekte edilir.
import { DexieFrameStore } from '../store/dexieFrameStore'
import type { WorkerToUiMessage } from './protocol'
import { createWorkerHandler } from './workerHandler'

const post = (message: WorkerToUiMessage): void => {
  globalThis.postMessage(message)
}

const frameStore = new DexieFrameStore({
  onWarning: (warning) => {
    post({
      type: 'ERROR',
      code: warning.code,
      message: warning.message,
    })
  },
})

const handler = createWorkerHandler({
  postMessage: post,
  frameStore,
  scheduler: {
    setInterval: (cb, ms) => globalThis.setInterval(cb, ms),
    clearInterval: (id) => globalThis.clearInterval(id),
  },
})

globalThis.onmessage = (event: MessageEvent<unknown>): void => {
  handler.handleMessage(event.data)
}
