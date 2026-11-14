// Ön-üretim kancası (predev/prebuild/pretest/pretypecheck): evidence:build + calibration:build.
import { spawnSync } from 'node:child_process'

const STEPS = ['evidence:build', 'calibration:build'] as const

for (const step of STEPS) {
  const result = spawnSync(`npm run ${step}`, { stdio: 'inherit', shell: true })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}
