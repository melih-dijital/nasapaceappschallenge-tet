// Web Worker giriş noktası (FAZ_03 §3.4). Gerçek setInterval yalnızca burada enjekte edilir.
import '../core/schema/jitless'
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
  // FAZ_11 §3.3: yalnızca `INIT {source:'ws'}` seçilirse kullanılır (varsayılan yerel simülatör).
  ...(typeof globalThis.WebSocket === 'function' ? { webSocket: globalThis.WebSocket } : {}),
  timers: {
    setTimeout: (cb, ms) => globalThis.setTimeout(cb, ms),
    clearTimeout: (id) => globalThis.clearTimeout(id as number),
  },
})

globalThis.onmessage = (event: MessageEvent<unknown>): void => {
  handler.handleMessage(event.data)
}
