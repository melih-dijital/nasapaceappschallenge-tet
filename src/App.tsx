import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppShell } from '@/ui/components/AppShell'
import { CockpitPage } from '@/ui/pages/CockpitPage'
import { EvidencePage } from '@/ui/pages/EvidencePage'
import { GroundPage } from '@/ui/pages/GroundPage'
import { ValidationPage } from '@/ui/pages/ValidationPage'

function App() {
  return (
    <BrowserRouter>
      <TooltipProvider>
        <AppShell>
          <Routes>
            <Route path="/" element={<CockpitPage />} />
            <Route path="/evidence" element={<EvidencePage />} />
            <Route path="/validation" element={<ValidationPage />} />
            <Route path="/ground" element={<GroundPage />} />
          </Routes>
        </AppShell>
      </TooltipProvider>
    </BrowserRouter>
  )
}

export default App
