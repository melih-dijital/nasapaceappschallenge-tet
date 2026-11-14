// i18n anahtarı: app.disclaimer — Faz 9'da sözlüğe bağlanacak; şimdilik sabit metin.
export function DisclaimerBar() {
  return (
    <div
      role="note"
      data-i18n-key="app.disclaimer"
      className="w-full border-b border-status-advisory/40 bg-status-advisory/10 px-4 py-1 text-center text-xs text-status-advisory"
    >
      Decision support prototype · synthetic data · not a medical device
    </div>
  )
}
