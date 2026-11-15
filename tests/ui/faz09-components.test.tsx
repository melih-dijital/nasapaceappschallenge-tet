// FAZ 9 §3.1 & §3.6 — Ortak bileşen testleri (ProvenanceTag varyantları, MetricTile, Gauge oran→açı, StatusBadge).
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { Gauge, fractionToAngle } from '@/ui/components/Gauge'
import { MetricTile } from '@/ui/components/MetricTile'
import { ProvenanceTag } from '@/ui/components/ProvenanceTag'
import { StatusBadge } from '@/ui/components/StatusBadge'

describe('ProvenanceTag kaynak ikonu (FAZ 9 §3.1 & §3.6, konsol tasarımı)', () => {
  it('5 kaynak türünü ve doğrulama durumunu tooltip/aria metninde gösterir; tıklama Evidence kaydına gider', () => {
    render(
      <MemoryRouter>
        <div>
          <ProvenanceTag evidenceId="rad.career.limit.msv" />
          <ProvenanceTag evidenceId="bone.loss.pct_month" />
          <ProvenanceTag evidenceId="rad.iss.rate.msv_day" />
          <ProvenanceTag evidenceId="spo2.critical" />
          <ProvenanceTag evidenceId="det.z.warning" />
        </div>
      </MemoryRouter>,
    )

    const cases = [
      ['rad.career.limit.msv', 'NASA_STD', /NASA standard/],
      ['bone.loss.pct_month', 'NASA_HRP', /NASA HRP/],
      ['rad.iss.rate.msv_day', 'PEER_REVIEWED', /Peer-reviewed/],
      ['spo2.critical', 'CLINICAL_CONVENTION', /Clinical convention/],
      ['det.z.warning', 'DEMO_PARAMETER', /Demo parameter · Unverified/],
    ] as const
    for (const [id, sourceType, label] of cases) {
      const tag = screen.getByTestId(`provenance-tag-${id}`)
      expect(tag).toHaveAttribute('data-source-type', sourceType)
      expect(tag.getAttribute('aria-label')).toMatch(label)
      expect(tag.getAttribute('aria-label')).toMatch(/^Threshold: /)
      expect(tag).toHaveAttribute('href', `/evidence?id=${encodeURIComponent(id)}`)
      // Rozet metni yok: yalnızca ikon
      expect(tag.textContent).toBe('')
    }

    const career = screen.getByTestId('provenance-tag-rad.career.limit.msv')
    expect(career).toHaveAttribute('data-verified', 'true')
    expect(career.getAttribute('aria-label')).toMatch(/600 mSv/)
    expect(screen.getByTestId('provenance-tag-det.z.warning')).toHaveAttribute(
      'data-verified',
      'false',
    )
  })
})
describe('MetricTile (FAZ 9 §3.1 & §3.6)', () => {
  it('değer, birim, z skoru, baseline medyanı ve sensor fault/stale uyarısını gösterir', () => {
    const spark = [
      { t: 0, value: 60 },
      { t: 1000, value: 64 },
      { t: 2000, value: 68 },
    ]
    const { rerender } = render(
      <MetricTile
        metric="hr"
        label="Heart Rate"
        value={72}
        unit="bpm"
        digits={0}
        z={2.4}
        baselineMedian={60}
        sparkline={spark}
      />,
    )

    const tile = screen.getByTestId('metric-tile-hr')
    expect(tile).toHaveTextContent('Heart Rate')
    expect(tile).toHaveTextContent('72')
    expect(tile).toHaveTextContent('bpm')
    expect(tile).toHaveTextContent('z = +2.4')
    expect(tile).toHaveTextContent('base 60 bpm')
    expect(screen.queryByTestId('sensor-fault-hr')).not.toBeInTheDocument()

    // Veri kalitesi hatası (sensorFault = true)
    rerender(
      <MetricTile
        metric="hr"
        label="Heart Rate"
        value={72}
        unit="bpm"
        digits={0}
        z={2.4}
        baselineMedian={60}
        sparkline={spark}
        sensorFault={true}
      />,
    )
    // Teknik FAULT etiketi yok: gri "Data gap" notu, değer gizlenir
    expect(screen.getByTestId('sensor-fault-hr')).toHaveTextContent('Data gap')
    expect(screen.getByTestId('metric-tile-hr')).not.toHaveTextContent('72')
  })
})

describe('Gauge oran → açı dönüşümü ve render (FAZ 9 §3.1, §3.4 & §3.6)', () => {
  it('fractionToAngle [0, 1] oranını [-90°, +90°] aralığına doğrusal eşler ve sınırları kırpar', () => {
    expect(fractionToAngle(0)).toBe(-90)
    expect(fractionToAngle(0.25)).toBe(-45)
    expect(fractionToAngle(0.5)).toBe(0)
    expect(fractionToAngle(0.75)).toBe(45)
    expect(fractionToAngle(1)).toBe(90)
    expect(fractionToAngle(-0.5)).toBe(-90)
    expect(fractionToAngle(1.5)).toBe(90)
  })

  it('600 mSv kariyer doz göstergesini doğru açı ve erişilebilir meter rolüyle çizer', () => {
    render(
      <MemoryRouter>
        <Gauge
          value={300}
          max={600}
          unit="mSv"
          label="NASA-STD-3001 career limit (verified)"
          provenanceId="rad.career.limit.msv"
        />
      </MemoryRouter>,
    )

    const meter = screen.getByRole('meter', { name: 'NASA-STD-3001 career limit (verified)' })
    expect(meter).toHaveAttribute('aria-valuenow', '300')
    expect(meter).toHaveAttribute('aria-valuemax', '600')
    expect(meter).toHaveAttribute('data-angle', '0.0')
    expect(screen.getByTestId('gauge-needle')).toHaveAttribute('data-angle', '0.0')
    expect(meter).toHaveTextContent('50% of 600 mSv')
  })
})

describe('StatusBadge & SeverityIcon (FAZ 9 §3.1)', () => {
  it('her durum seviyesi için hem ikon hem metin gösterir (renk tek başına anlam taşımaz)', () => {
    render(
      <div>
        <StatusBadge severity="INFO" />
        <StatusBadge severity="ADVISORY" />
        <StatusBadge severity="WARNING" />
        <StatusBadge severity="CRITICAL" />
      </div>,
    )

    expect(screen.getByTestId('status-badge-INFO')).toHaveTextContent('Info')
    expect(screen.getByTestId('severity-icon-INFO')).toBeInTheDocument()

    expect(screen.getByTestId('status-badge-ADVISORY')).toHaveTextContent('Advisory')
    expect(screen.getByTestId('severity-icon-ADVISORY')).toBeInTheDocument()

    expect(screen.getByTestId('status-badge-WARNING')).toHaveTextContent('Warning')
    expect(screen.getByTestId('severity-icon-WARNING')).toBeInTheDocument()

    expect(screen.getByTestId('status-badge-CRITICAL')).toHaveTextContent('Critical')
    expect(screen.getByTestId('severity-icon-CRITICAL')).toBeInTheDocument()
  })
})
