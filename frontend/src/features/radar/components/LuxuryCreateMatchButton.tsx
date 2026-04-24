import { Plus } from 'lucide-react'
import styles from './LuxuryCreateMatchButton.module.css'

interface LuxuryCreateMatchButtonProps {
  onClick: () => void
}

export function LuxuryCreateMatchButton({ onClick }: LuxuryCreateMatchButtonProps) {
  return (
    <button type="button" className={styles.button} onClick={onClick}>
      <span className={styles.buttonGlow} aria-hidden="true" />
      <Plus size={16} aria-hidden="true" />
      <span>Crear Partido</span>
    </button>
  )
}
