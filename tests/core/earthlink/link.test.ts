import { describe, expect, it } from 'vitest'
import { EarthLink } from '@/core/earthlink/link'
import { getNumber } from '@/core/evidence/registry'
import type { Alert } from '@/core/types/alert'
import { minToMs, secToMs } from '@/core/units'

function makeAlert(id: string, severity: Alert['severity'] = 'WARNING', state: Alert['state'] = 'fatigue'): Alert {
  return {
    id,
    crewId: 'CREW_01',
    kind: 'STATE',
    severity,
    state,
    titleKey: `alert.${state}.title`,
    whyKeys: [],
    evidenceIds: [],
    suggestedActionIds: ['ACT_REST_BLOCK'],
    earthDelayClass: 'ACT_THEN_REPORT',
    confidence: 0.9,
    status: 'ACTIVE',
    firstSeenT: 0,
    lastSeenT: 0,
  }
}

describe('EarthLink Simulator (Faz 7 §3.4)', () => {
  it('gecikmeli teslimat: sendT ve arriveT değerlerini oneWayDelaySec + bant genişliğine göre hesaplar', () => {
    const link = new EarthLink({
      preset: 'MARS_MIN', // 180 sn tek yön
      initialSimT: 1000,
    })

    const msg = link.send({
      priority: 1,
      category: 'STATUS',
      payload: { kind: 'STATUS', t: 1000 },
    })

    expect(msg).not.toBeNull()
    expect(msg?.status).toBe('IN_FLIGHT')
    expect(msg?.sendT).toBeGreaterThanOrEqual(1000)
    expect(msg?.sendT).toBeLessThan(1050)
    expect(msg?.arriveT).toBe(msg!.sendT! + secToMs(180))

    link.tick(msg!.arriveT! - 1)
    expect(link.getState().outbox[0]?.status).toBe('IN_FLIGHT')

    link.tick(msg!.arriveT!)
    expect(link.getState().outbox[0]?.status).toBe('DELIVERED')
  })

  it('blackout sırasında kuyruklar; bağlantı gelince yüksek öncelik > eski tarih sırasıyla gönderir', () => {
    const link = new EarthLink({
      preset: 'MARS_MIN',
      config: { blackout: true },
      initialSimT: 0,
    })

    const low = link.send({ id: 'LOW_1', priority: 0, category: 'STATUS', payload: { seq: 1 } })!
    link.tick(1000)
    const highOld = link.send({ id: 'HIGH_OLD', priority: 3, category: 'ALERT', payload: { seq: 2 } })!
    link.tick(2000)
    const med = link.send({ id: 'MED_1', priority: 1, category: 'STATUS', payload: { seq: 3 } })!
    link.tick(3000)
    const highNew = link.send({ id: 'HIGH_NEW', priority: 3, category: 'ALERT', payload: { seq: 4 } })!

    expect([low.status, highOld.status, med.status, highNew.status]).toEqual([
      'QUEUED',
      'QUEUED',
      'QUEUED',
      'QUEUED',
    ])

    link.setBlackout(false)
    const state = link.getState()
    const dispatched = state.outbox
      .filter((m) => m.status === 'IN_FLIGHT')
      .sort((a, b) => (a.sendT ?? 0) - (b.sendT ?? 0))
    expect(dispatched.map((m) => m.id)).toEqual(['HIGH_OLD', 'HIGH_NEW', 'MED_1', 'LOW_1'])
    expect(dispatched[0]!.sendT!).toBeLessThan(dispatched[1]!.sendT!)
    expect(dispatched[1]!.sendT!).toBeLessThan(dispatched[2]!.sendT!)
    expect(dispatched[2]!.sendT!).toBeLessThan(dispatched[3]!.sendT!)
  })

  it('earth.outbox.capacity dolduğunda kuyruktaki daha düşük öncelikli mesaj düşer', () => {
    const capacity = getNumber('earth.outbox.capacity')
    const link = new EarthLink({
      preset: 'MARS_MIN',
      config: { blackout: true },
    })

    for (let i = 0; i < capacity; i += 1) {
      link.send({ id: `Q_LOW_${i}`, priority: 0, category: 'STATUS', payload: { i } })
    }
    expect(link.getState().outbox).toHaveLength(capacity)

    const critical = link.send({
      id: 'Q_CRIT',
      priority: 3,
      category: 'ALERT',
      payload: { urgent: true },
    })
    expect(critical).not.toBeNull()
    const ids = link.getState().outbox.map((m) => m.id)
    expect(ids).toHaveLength(capacity)
    expect(ids).toContain('Q_CRIT')
    expect(ids).not.toContain('Q_LOW_0')
  })

  it('reportAlert otomatik yer cevabı planlar ve getPendingReplies ETA ile geri sayım verir', () => {
    const groundMin = getNumber('earth.groundProcessingMin')
    const link = new EarthLink({
      preset: 'CUSTOM',
      config: { oneWayDelaySec: 840 }, // 14 dk
      initialSimT: 0,
    })

    const sent = link.reportAlert(makeAlert('AL_101', 'WARNING', 'dehydration'))
    expect(sent).not.toBeNull()
    expect(link.getState().pending).toHaveLength(1)

    const pendingBefore = link.getPendingReplies()[0]!
    expect(pendingBefore.relatedAlertId).toBe('AL_101')
    expect(pendingBefore.localAdviceActionIds).toEqual(['ACT_REST_BLOCK'])
    expect(pendingBefore.etaT).toBe(sent!.arriveT! + minToMs(groundMin) + secToMs(840))

    link.tick(pendingBefore.etaT - 1)
    expect(link.getState().inbox).toHaveLength(0)

    link.tick(pendingBefore.etaT)
    expect(link.getState().inbox).toHaveLength(1)
    expect(link.getState().inbox[0]?.direction).toBe('DOWN')
    expect(link.getPendingReplies()).toHaveLength(0)
  })

  it('kullanıcı gecikme ayarı senaryo komutuna üstün gelir ve yoldaki mesajların arriveT değeri değişmez', () => {
    const link = new EarthLink({
      preset: 'MARS_MIN', // 180 sn
      initialSimT: 0,
    })

    const inFlightMsg = link.send({
      id: 'MSG_INFLIGHT',
      priority: 2,
      category: 'ALERT',
      payload: { a: 1 },
    })!
    const lockedArriveT = inFlightMsg.arriveT!

    link.setUserConfig({ oneWayDelaySec: 600, preset: 'CUSTOM' })
    link.applyScenarioConfig({ oneWayDelaySec: 60, preset: 'MOON' })
    // Kullanıcı gecikme override'ı olduğu için 600 sn korunmalı
    expect(link.getConfig().oneWayDelaySec).toBe(600)

    // Yoldaki mesajın arriveT değeri eski 180 sn gecikmede sabit kalır
    const updatedOutboxMsg = link.getState().outbox.find((m) => m.id === 'MSG_INFLIGHT')!
    expect(updatedOutboxMsg.arriveT).toBe(lockedArriveT)

    // Yeni mesaj yeni 600 sn gecikmeyi kullanır
    const nextMsg = link.send({
      id: 'MSG_NEW',
      priority: 1,
      category: 'STATUS',
      payload: { a: 2 },
    })!
    expect(nextMsg.arriveT).toBeGreaterThanOrEqual(secToMs(600))
  })

  it('gizlilik kapısı: payload içinde journal / ham check-in anahtarı varsa gönderimi reddeder', () => {
    const link = new EarthLink({ preset: 'MOON' })
    expect(() =>
      link.send({
        priority: 1,
        category: 'BEHAVIOR',
        payload: { journalText: 'secret' },
      }),
    ).toThrow(/privacy policy violation/i)
    expect(link.getState().outbox).toHaveLength(0)
  })

  it('sendTelemetryBatch: oneWayDelaySec sonra groundMirror ve downlink güncellenir; kesintide (blackout) kuyrukta bekler ve bağlantı dönünce sırayla ulaşır', () => {
    const link = new EarthLink({
      preset: 'MARS_MIN', // 180 sn tek yön
      initialSimT: 0,
    })

    // Başlangıçta henüz Dünya'ya ulaşmış veri yok
    expect(link.getGroundMirror().asOfT).toBeNull()
    expect(link.getDownlink()).toMatchObject({
      queued: 0,
      inFlight: 0,
      lastDeliveredT: null,
    })

    const batch0 = link.sendTelemetryBatch(
      {
        t: 0,
        fromT: 0,
        latest: { 'cdr|hr': 62 },
        states: [
          {
            crewId: 'cdr',
            state: 'fatigue',
            t: 0,
            score: 0.2,
            confidence: 1,
            contributors: [],
          },
        ],
        activeAlerts: [],
        cumulativeDoseByCrew: { cdr: 0.1 },
      },
      0,
    )
    expect(batch0).not.toBeNull()
    expect(batch0?.status).toBe('IN_FLIGHT')
    expect(link.getDownlink().inFlight).toBe(1)
    expect(link.getGroundMirror().asOfT).toBeNull()

    // oneWayDelaySec (180 sn) tamamlanınca Dünya aynası (groundMirror) güncellenir
    link.tick(batch0!.arriveT!)
    expect(link.getGroundMirror()).toMatchObject({
      asOfT: 0,
      delaySec: 180,
      linkUp: true,
      latest: { 'cdr|hr': 62 },
      cumulativeDoseByCrew: { cdr: 0.1 },
    })
    expect(link.getDownlink()).toMatchObject({
      queued: 0,
      inFlight: 0,
      lastDeliveredT: batch0!.arriveT!,
    })

    // Kesinti (blackout) başlar: t=15 dk ve t=30 dk paketleri kuyrukta bekler; groundMirror asOfT=0'da sabit kalır
    link.setBlackout(true, 'SCENARIO')
    const t15 = minToMs(15)
    const t30 = minToMs(30)
    link.tick(t15)
    link.sendTelemetryBatch({ t: t15, fromT: 0, latest: { 'cdr|hr': 68 } }, t15)
    link.tick(t30)
    link.sendTelemetryBatch({ t: t30, fromT: t15, latest: { 'cdr|hr': 74 } }, t30)

    expect(link.getGroundMirror()).toMatchObject({
      asOfT: 0,
      linkUp: false,
      latest: { 'cdr|hr': 62 },
    })
    expect(link.getDownlink().queued).toBe(2)
    expect(link.getDownlink().inFlight).toBe(0)

    // Bağlantı t=45 dk'da geri gelir: paketler sırayla yola çıkar ve oneWayDelaySec sonra sırayla ulaşır
    const t45 = minToMs(45)
    link.tick(t45)
    link.setBlackout(false, 'SCENARIO')
    expect(link.getGroundMirror().linkUp).toBe(true)
    expect(link.getDownlink().queued).toBe(0)
    expect(link.getDownlink().inFlight).toBe(2)

    const recentInFlight = link.getDownlink().recent.filter((r) => r.status === 'IN_FLIGHT')
    expect(recentInFlight.map((r) => r.createdT)).toEqual([t15, t30])
    expect(recentInFlight[0]!.arriveT!).toBeLessThan(recentInFlight[1]!.arriveT!)

    // İlk paket (t=15 dk) ulaştığında groundMirror asOfT=t15 olur
    link.tick(recentInFlight[0]!.arriveT!)
    expect(link.getGroundMirror().asOfT).toBe(t15)
    expect(link.getGroundMirror().latest['cdr|hr']).toBe(68)

    // İkinci paket (t=30 dk) ulaştığında groundMirror asOfT=t30 olur
    link.tick(recentInFlight[1]!.arriveT!)
    expect(link.getGroundMirror().asOfT).toBe(t30)
    expect(link.getGroundMirror().latest['cdr|hr']).toBe(74)
  })
})
