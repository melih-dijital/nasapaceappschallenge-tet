import { useT } from '@/ui/i18n'
import { PlaceholderPage } from './PlaceholderPage'

export function GroundPage() {
  const { t } = useT()
  return <PlaceholderPage title={t('nav.ground')} />
}
