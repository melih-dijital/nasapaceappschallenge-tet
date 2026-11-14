// `npm run check`: typecheck → lint → test → build, sırayla; ilk hatada durur.
// Kabuktan bağımsız (Windows PowerShell'de && zinciri yok — PROJECT_MEMORY §10).
import { spawnSync } from 'node:child_process'

const STEPS = ['typecheck', 'lint', 'test', 'build'] as const

for (const step of STEPS) {
  console.log(`\n=== npm run ${step} ===`)
  const result = spawnSync(`npm run ${step}`, { stdio: 'inherit', shell: true })
  if (result.status !== 0) {
    console.error(`\ncheck: "${step}" başarısız (exit ${result.status ?? 'null'})`)
    process.exit(result.status ?? 1)
  }
}

console.log('\ncheck: typecheck + lint + test + build — hepsi başarılı')
