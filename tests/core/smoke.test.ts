import { describe, expect, it } from 'vitest'

describe('altyapı (node ortamı)', () => {
  it('1 + 1 = 2', () => {
    expect(1 + 1).toBe(2)
  })

  it("DOM global'leri yok", () => {
    expect(typeof globalThis.document).toBe('undefined')
  })
})
