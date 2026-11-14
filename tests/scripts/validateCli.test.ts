// Doğrulama CLI duman testi (FAZ_08 §3.6): Node ortamında `validate --quick` çalıştırılır ve çıktı doğrulanır.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ValidationReportSchema } from '../../src/core/validation'

describe('validate CLI', () => {
  it('validate --quick çıkış kodu 0 döner, JSON şeması ve MD raporu deterministik oluşur', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-val-cli-'))
    const tsxCli = path.resolve(process.cwd(), 'node_modules/tsx/dist/cli.mjs')
    try {
      const res = spawnSync(
        process.execPath,
        [
          tsxCli,
          'scripts/validate.ts',
          '--quick',
          '--scenarios',
          'new_crew_member',
          '--no-sensitivity',
          '--out-dir',
          tmpDir,
        ],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
        },
      )

      expect(res.status, res.stderr || res.stdout).toBe(0)
      const jsonFile = path.join(tmpDir, 'validation-report.json')
      const mdFile = path.join(tmpDir, 'validation-report.md')
      expect(fs.existsSync(jsonFile)).toBe(true)
      expect(fs.existsSync(mdFile)).toBe(true)

      const parsedJson = JSON.parse(fs.readFileSync(jsonFile, 'utf8')) as unknown
      expect(() => ValidationReportSchema.parse(parsedJson)).not.toThrow()
      const mdText = fs.readFileSync(mdFile, 'utf8')
      expect(mdText).toContain('# Validation Report')
      expect(mdText).toContain('## Limitations (Mandatory)')
      expect(mdText).toContain('WARNING+ FP')
      expect(mdText).toContain('ADVISORY Noise')
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  }, 30_000)
})
