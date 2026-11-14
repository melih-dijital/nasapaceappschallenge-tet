import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { PwaStatus } from '@/pwa/PwaStatus'
import { AppShell } from '@/ui/components/AppShell'
import { CockpitPage } from '@/ui/pages/CockpitPage'

// FAZ_11 §3.6: ağır sayfalar rota bazlı lazy (ana paket ≤ 500 kB gzip). Kokpit ana pakette kalır (ilk ekran).
const EvidencePage = lazy(() => import('@/ui/pages/EvidencePage').then((m) => ({ default: m.EvidencePage })))
const ValidationPage = lazy(() => import('@/ui/pages/ValidationPage').then((m) => ({ default: m.ValidationPage })))
const GroundPage = lazy(() => import('@/ui/pages/GroundPage').then((m) => ({ default: m.GroundPage })))

function RouteFallback() {
  return (
    <p role="status" className="text-sm text-muted-foreground">
      Loading…
    </p>
  )
}

function App() {
  return (
    <BrowserRouter>
      <TooltipProvider>
        <AppShell>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<CockpitPage />} />
              <Route path="/evidence" element={<EvidencePage />} />
              <Route path="/validation" element={<ValidationPage />} />
              <Route path="/ground" element={<GroundPage />} />
            </Routes>
          </Suspense>
        </AppShell>
        <PwaStatus />
      </TooltipProvider>
    </BrowserRouter>
  )
}

export default App
