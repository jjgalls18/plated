import { useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import PlatedLogo from './PlatedLogo'
import { useAppStore } from '../../stores/useAppStore'

export default function PageHeader({ right }) {
  const navigate = useNavigate()
  const { darkMode } = useAppStore()
  const tapCount = useRef(0)
  const tapTimer = useRef(null)

  const handleTap = useCallback(() => {
    tapCount.current += 1
    clearTimeout(tapTimer.current)
    if (tapCount.current >= 5) {
      tapCount.current = 0
      navigate('/admin')
      return
    }
    tapTimer.current = setTimeout(() => { tapCount.current = 0 }, 1500)
  }, [navigate])

  return (
    <div className="flex items-center h-20 px-5 bg-cream dark:bg-stone-900">
      <div className="flex-1" />

      <button
        onClick={handleTap}
        className="rounded-full active:scale-90 transition-transform"
        aria-label="Plated"
      >
        <PlatedLogo size={72} dark={darkMode} />
      </button>

      <div className="flex-1 flex items-center justify-end gap-2">
        {right}
      </div>
    </div>
  )
}
