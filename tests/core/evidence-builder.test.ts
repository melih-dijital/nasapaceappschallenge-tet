import { describe, expect, it } from 'vitest'
import { formatIssue } from '@/core/evidence/markdown'
import {
  buildEvidence,
  parseEvidenceValue,
  renderEvidenceIdsTs,
  renderEvidenceJson,
  type SourceMdFile,
} from '@/core/evidence/sourceMd'
import sourceTemplate from '../../templates/SOURCE_TEMPLATE.md?raw'

const HEADER = '| evidenceId | metric | value | unit | status | scope | note |\n|---|---|---|---|---|---|---|'

/** Geçici fixture md: front matter + "## Değerler" tablosu. */
function sourceFile(
  name: string,
  rows: string[],
  options: { frontMatterExtra?: string; header?: string; sourceType?: string; url?: string } = {},
): SourceMdFile {
  const id = name.replace(/\.md$/, '')
  const content = [
    '---',
    `id: ${id}`,
    'title: Test kaynağı',
    `url: ${options.url ?? 'https://example.org/source.pdf'}`,
    `sourceType: ${options.sourceType ?? 'NASA_STD'}`,
    ...(options.frontMatterExtra ? [options.frontMatterExtra] : []),
    'owner: Test',
    '---',
    '',
    '## Özet',
    'Fixture.',
    '',
    '## Değerler',
    options.header ?? HEADER,
    ...rows,
    '',
  ].join('\n')
  return { path: `docs/sources/${name}`, content }
}

const firstIssue = (files: SourceMdFile[]): string => {
  const { issues } = buildEvidence(files)
  expect(issues.length).toBeGreaterThan(0)
  return formatIssue(issues[0] ?? { file: '', line: 0, message: '' })
}

describe('parseEvidenceValue', () => {
  it.each([
    ['600', 600],
    ['0.5', 0.5],
    ['0.2-0.5', [0.2, 0.5]],
    ['0.2–0.5', [0.2, 0.5]],
    ['1 – 1.5', [1, 1.5]],
    ['+10–12', [10, 12]],
  ])('"%s" → %j', (raw, expected) => {
    expect(parseEvidenceValue(raw)).toEqual(expected)
  })

  it.each(['yüksek', '', '1,5', '5-1', '1-2-3'])('"%s" geçersiz', (raw) => {
    expect(typeof parseEvidenceValue(raw)).toBe('string')
  })
})

describe('buildEvidence', () => {
  it('geçerli md: kayıtlar id sırasıyla, verified türetilir, kaynak front matter\'dan', () => {
    const { entries, issues } = buildEvidence([
      sourceFile('limits.md', [
        '| rad.z | dose | 600 | mSv | VERIFIED | tüm | kariyer | ',
        '| rad.a | rate | 0.2–0.5 | mSv/gün | PARTIAL | ISS | |',
      ]),
    ])
    expect(issues).toEqual([])
    expect(entries.map((e) => e.id)).toEqual(['rad.a', 'rad.z'])
    expect(entries[1]).toEqual({
      id: 'rad.z',
      value: 600,
      unit: 'mSv',
      sourceType: 'NASA_STD',
      sourceTitle: 'Test kaynağı',
      sourceUrl: 'https://example.org/source.pdf',
      note: 'kariyer',
      verificationStatus: 'VERIFIED',
      verified: true,
      owner: 'Test',
      scope: 'tüm',
    })
    expect(entries[0]?.verified).toBe(false)
    expect(entries[0]?.value).toEqual([0.2, 0.5])
  })

  it('satır düzeyindeki sourceType/sourceTitle/sourceUrl front matter\'ı ezer', () => {
    const header =
      '| evidenceId | metric | value | unit | status | scope | note | sourceType | sourceTitle | sourceUrl |\n|---|---|---|---|---|---|---|---|---|---|'
    const { entries, issues } = buildEvidence([
      sourceFile(
        'mixed.md',
        [
          '| a.one | m | 1 | x | VERIFIED | | | NASA_HRP | HRP sayfası | https://example.org/hrp |',
          '| a.two | m | 90 | % | PARTIAL | | | CLINICAL_CONVENTION | Klinik | — |',
          '| a.three | m | 10 | pfu | UNVERIFIED | | | | | |',
        ],
        { header, sourceType: 'DEMO_PARAMETER', url: '—' },
      ),
    ])
    expect(issues).toEqual([])
    expect(entries.map((e) => [e.id, e.sourceType, e.sourceTitle, e.sourceUrl])).toEqual([
      ['a.one', 'NASA_HRP', 'HRP sayfası', 'https://example.org/hrp'],
      ['a.three', 'DEMO_PARAMETER', 'Test kaynağı', '—'],
      ['a.two', 'CLINICAL_CONVENTION', 'Klinik', '—'],
    ])
  })

  it('`_` ile başlayan dosyalar atlanır (biçimi bozuk olsa bile)', () => {
    const result = buildEvidence([
      { path: 'docs/sources/_notes.md', content: '# serbest not, front matter yok' },
      sourceFile('ok.md', ['| x.y | m | 1 | u | VERIFIED | | |']),
    ])
    expect(result.issues).toEqual([])
    expect(result.skippedFiles).toEqual(['docs/sources/_notes.md'])
    expect(result.entries).toHaveLength(1)
  })

  it('tekrar eden evidenceId: iki konum ve seed çözüm önerisi', () => {
    const message = firstIssue([
      sourceFile('seed-verified-values.md', ['| dup.id | m | 1 | u | VERIFIED | | |']),
      sourceFile('team.md', ['| dup.id | m | 2 | u | VERIFIED | | |']),
    ])
    expect(message).toContain('docs/sources/team.md:15:')
    expect(message).toContain('ilk tanım: docs/sources/seed-verified-values.md:15')
    expect(message).toContain('seed-verified-values.md içindeki satırı sil')
  })

  it('hatalı sütun başlığı: dosya + satır no', () => {
    const header = '| id | metric | value | unit | verified | scope | note |\n|---|---|---|---|---|---|---|'
    const message = firstIssue([sourceFile('bad.md', ['| a.b | m | 1 | u | true | | |'], { header })])
    expect(message).toMatch(/^docs\/sources\/bad\.md:13: tablo sütunları şablonla aynı olmalı/)
  })

  it('eksik hücre: dosya + satır no', () => {
    const message = firstIssue([sourceFile('short.md', ['| a.b | m | 1 | u | VERIFIED |'])])
    expect(message).toBe('docs/sources/short.md:15: 7 sütun bekleniyordu, 5 bulundu')
  })

  it('sayı olmayan value reddedilir', () => {
    expect(firstIssue([sourceFile('nan.md', ['| a.b | m | yüksek | u | PARTIAL | | |'])])).toContain(
      'docs/sources/nan.md:15: value sayı veya "min-max"',
    )
  })

  it('DEMO_PARAMETER + status ≠ UNVERIFIED reddedilir', () => {
    const message = firstIssue([
      sourceFile('demo.md', ['| det.x | demo | 2 | z | VERIFIED | | |'], {
        sourceType: 'DEMO_PARAMETER',
      }),
    ])
    expect(message).toContain('DEMO_PARAMETER satırı status=UNVERIFIED olmalı')
  })

  it('VERIFIED satırda URL zorunlu; boşluklu URL reddedilir', () => {
    expect(firstIssue([sourceFile('nourl.md', ['| a.b | m | 1 | u | VERIFIED | | |'], { url: '—' })])).toContain(
      'VERIFIED satırda http(s):// URL zorunlu',
    )
    const spaced = buildEvidence([
      sourceFile('space.md', ['| a.b | m | 1 | u | PARTIAL | | |'], { url: 'https://x.org/a b.pdf' }),
    ])
    expect(spaced.issues.map((i) => i.message).join('\n')).toContain('%20')
  })

  it("front matter'da verified alanı, bilinmeyen sourceType ve id≠dosya adı reddedilir", () => {
    const { issues } = buildEvidence([
      sourceFile('fm.md', ['| a.b | m | 1 | u | VERIFIED | | |'], { frontMatterExtra: 'verified: true' }),
      sourceFile('type.md', ['| c.d | m | 1 | u | PARTIAL | | |'], { sourceType: 'NASA' }),
      { ...sourceFile('right-id.md', ['| e.f | m | 1 | u | PARTIAL | | |']), path: 'docs/sources/wrong.md' },
    ])
    const text = issues.map(formatIssue).join('\n')
    expect(text).toContain("docs/sources/fm.md:6: front matter'da 'verified' alanı YOK")
    expect(text).toContain('docs/sources/type.md:5: bilinmeyen sourceType "NASA"')
    expect(text).toContain('docs/sources/wrong.md:2: front matter id "right-id" dosya adıyla aynı olmalı')
  })

  it('front matter veya "## Değerler" yoksa hata', () => {
    const { issues } = buildEvidence([
      { path: 'docs/sources/plain.md', content: '# Başlık\n\nSerbest metin.' },
      { path: 'docs/sources/notable.md', content: '---\nid: notable\ntitle: T\nurl: —\nsourceType: NASA_HRP\n---\n\n## Özet\n' },
    ])
    expect(issues.map(formatIssue)).toEqual([
      'docs/sources/notable.md:1: "## Değerler" başlığı yok',
      "docs/sources/plain.md:1: front matter yok: dosya '---' satırıyla başlamalı",
    ])
  })

  it('SOURCE_TEMPLATE.md şablonun kendisi hatasız ayrışır', () => {
    const { entries, issues } = buildEvidence([
      { path: 'docs/sources/nasa-std-3001-v1-radiation.md', content: sourceTemplate },
    ])
    expect(issues).toEqual([])
    expect(entries.map((e) => e.id)).toEqual(['rad.career.limit.msv', 'rad.spe.limit.msv'])
  })

  it('deterministik: dosya sırası çıktıyı değiştirmez', () => {
    const a = sourceFile('a.md', ['| k.two | m | 2 | u | PARTIAL | | |'])
    const b = sourceFile('b.md', ['| k.one | m | 1 | u | PARTIAL | | |'])
    const first = buildEvidence([a, b]).entries
    const second = buildEvidence([b, a]).entries
    expect(renderEvidenceJson(first)).toBe(renderEvidenceJson(second))
    expect(renderEvidenceIdsTs(first)).toContain("  'k.one',\n  'k.two',\n] as const")
  })
})
