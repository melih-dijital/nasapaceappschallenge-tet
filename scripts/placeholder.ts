// Henüz yazılmamış npm script'leri için yer tutucu (Faz 0).
const PLANNED: Record<string, string> = {
  'evidence:build': "Faz 1'de eklenecek",
  validate: "Faz 8'de eklenecek",
}

const name = process.argv[2] ?? ''
console.log(`${name}: ${PLANNED[name] ?? 'henüz tanımlı değil'}`)
