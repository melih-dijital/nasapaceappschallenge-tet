import { useT } from '@/ui/i18n'
import { PlaceholderPage } from './PlaceholderPage'

export function ValidationPage() {
  const { t } = useT()
  return <PlaceholderPage title={t('nav.validation')} />
}
