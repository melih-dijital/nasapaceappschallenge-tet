import { lazy, Suspense } from 'react'
import { Compass } from 'lucide-react'
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { PwaStatus } from '@/pwa/PwaStatus'
import { AppShell } from '@/ui/components/AppShell'
import { EmptyState } from '@/ui/components/EmptyState'
import { ErrorBoundary } from '@/ui/components/ErrorBoundary'
import { useT } from '@/ui/i18n'
import { CockpitPage } from '@/ui/pages/CockpitPage'

// FAZ_11 §3.6: ağır sayfalar rota bazlı lazy (ana paket ≤ 500 kB gzip). Kokpit ana pakette kalır (ilk ekran).
const EvidencePage = lazy(() =>
  import('@/ui/pages/EvidencePage').then((m) => ({ default: m.EvidencePage })),
)
const ValidationPage = lazy(() =>
  import('@/ui/pages/ValidationPage').then((m) => ({ default: m.ValidationPage })),
)
const GroundPage = lazy(() =>
  import('@/ui/pages/GroundPage').then((m) => ({ default: m.GroundPage })),
)

// `/alerts` ve `/behavioral` AppShell içinde çizilir (Faz 10); burada boş eşleşme, "bulunamadı" düşmesin.
const SHELL_ROUTES = ['/alerts', '/behavioral']

function RouteFallback() {
  const { t } = useT()
  return (
    <p role="status" className="text-sm text-muted-foreground">
      {t('route.loading')}
    </p>
  )
}

/** FAZ 12 boş durum: bilinmeyen rota (ör. eski yer imi, yanlış yazılmış URL). */
function NotFound() {
  const { t } = useT()
  const { pathname } = useLocation()
  if (SHELL_ROUTES.includes(pathname)) return null
  return (
    <div data-testid="not-found" className="mx-auto max-w-md py-10">
      <EmptyState
        icon={<Compass aria-hidden="true" className="size-4" />}
        title={t('notFound.title')}
        description={t('notFound.desc')}
        action={
          <Link
            to="/"
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {t('notFound.back')}
          </Link>
        }
      />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <TooltipProvider>
        {/* FAZ 12 hata durumu: kabuğun (üst çubuk/kenar) kendisi çökerse beyaz ekran yerine kurtarma kartı */}
        <ErrorBoundary>
          <AppShell>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<CockpitPage />} />
                <Route path="/evidence" element={<EvidencePage />} />
                <Route path="/validation" element={<ValidationPage />} />
                <Route path="/ground" element={<GroundPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AppShell>
        </ErrorBoundary>
        <PwaStatus />
      </TooltipProvider>
    </BrowserRouter>
  )
}

export default App
