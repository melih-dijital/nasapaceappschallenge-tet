// Faz 0 yer tutucusu: sayfa içerikleri Faz 9–10'da doldurulacak.
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <section aria-labelledby="page-title" className="space-y-2">
      <h1 id="page-title" className="text-xl font-semibold">
        {title}
      </h1>
      <p className="text-sm text-muted-foreground">Faz 9–10'da doldurulacak</p>
    </section>
  )
}
