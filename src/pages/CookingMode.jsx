import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { X, ChevronLeft, ChevronRight, Timer, Play, Pause, RotateCcw, Users, ListChecks, Check, Sun } from 'lucide-react'
import { useRecipe } from '../hooks/useRecipes'
import { useAuth } from '../hooks/useAuth'
import { usePartner } from '../hooks/usePartner'
import { useWakeLock } from '../hooks/useWakeLock'
import { findStepTimes, scaleAmount } from '../lib/cooking'
import toast from 'react-hot-toast'

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const mmss = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return h ? `${h}:${mmss}` : mmss
}

// Three short beeps. The AudioContext has to be created inside a tap (iOS
// refuses to make sound otherwise), so the timer's start button builds it and
// hands it here when the countdown ends.
function beep(ctx) {
  if (!ctx) return
  try {
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = 880
      gain.gain.value = 0.25
      osc.connect(gain).connect(ctx.destination)
      const at = ctx.currentTime + i * 0.35
      osc.start(at)
      osc.stop(at + 0.2)
    }
  } catch { /* sound is a nicety; the toast still shows */ }
}

export default function CookingMode() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { data: recipe, isLoading } = useRecipe(id)
  const { profile } = useAuth()
  const { partner } = usePartner()
  const screenAwake = useWakeLock()

  // Carried over from the recipe page's serving stepper, so the ingredient
  // list in here matches what was being looked at out there.
  const scale = Math.min(20, Math.max(0.5, parseFloat(searchParams.get('scale')) || 1))

  const myName = profile?.display_name || 'You'
  const partnerName = partner?.display_name || 'Partner'

  const PERSON1 = { name: myName, bg: 'bg-primary', text: 'text-white' }
  const PERSON2 = { name: partnerName, bg: 'bg-sage', text: 'text-white' }
  const getPerson = (index) => index % 2 === 0 ? PERSON1 : PERSON2

  const [stepIndex, setStepIndex] = useState(0)
  const [cookTogether, setCookTogether] = useState(false)
  const [showIngredients, setShowIngredients] = useState(false)
  const [usedIngredients, setUsedIngredients] = useState(() => new Set())

  // Timer state. The countdown is measured against a wall-clock end time
  // rather than by counting ticks: a backgrounded tab or a locked phone stops
  // delivering ticks, and a timer that loses three minutes while someone
  // checks a text is worse than no timer.
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerInput, setTimerInput] = useState('')
  const [timerStep, setTimerStep] = useState(null)
  const endsAtRef = useRef(0)
  const audioRef = useRef(null)

  const tick = useCallback(() => {
    const left = Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000))
    setTimerSeconds(left)
    if (left === 0) {
      setTimerRunning(false)
      setTimerStep(null)
      beep(audioRef.current)
      toast('⏰ Timer done!', {
        duration: 8000,
        style: { background: '#C4622D', color: '#fff', fontWeight: '600' },
      })
    }
  }, [])

  useEffect(() => {
    if (!timerRunning) return
    const interval = setInterval(tick, 500)
    // Catch up the moment the app comes back to the foreground.
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [timerRunning, tick])

  useEffect(() => () => { audioRef.current?.close?.().catch(() => {}) }, [])

  const beginCountdown = (seconds) => {
    if (!audioRef.current) {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext
        if (Ctx) audioRef.current = new Ctx()
      } catch { /* no sound available */ }
    }
    audioRef.current?.resume?.().catch(() => {})
    endsAtRef.current = Date.now() + seconds * 1000
    setTimerSeconds(seconds)
    setTimerRunning(true)
  }

  const startTimer = (seconds) => {
    setTimerInput('')
    setTimerStep(stepIndex)
    beginCountdown(seconds)
  }

  const startTypedTimer = () => {
    const mins = parseFloat(timerInput)
    if (!timerInput || isNaN(mins) || mins <= 0) {
      toast.error('Enter a time in minutes first')
      return
    }
    startTimer(Math.round(mins * 60))
  }

  const pauseResumeTimer = () => {
    if (timerRunning) setTimerRunning(false)
    else beginCountdown(timerSeconds)
  }

  const resetTimer = () => {
    setTimerRunning(false)
    setTimerSeconds(0)
    setTimerInput('')
    setTimerStep(null)
  }

  const toggleIngredient = (i) => setUsedIngredients((prev) => {
    const next = new Set(prev)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    return next
  })

  if (isLoading) return <CookingSkeleton />

  if (!recipe || !recipe.steps?.length) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
        <p className="text-white/50 text-sm">No steps found for this recipe.</p>
        <button onClick={() => navigate(-1)} className="text-primary font-semibold text-sm">Go back</button>
      </div>
    )
  }

  const steps = recipe.steps
  const total = steps.length
  const current = steps[stepIndex]
  const stepText = typeof current === 'string' ? current : (current?.text || '')
  const suggestedTimes = findStepTimes(stepText)
  const ingredients = recipe.ingredients || []
  const person = getPerson(stepIndex)
  const isFirst = stepIndex === 0
  const isLast = stepIndex === total - 1

  const goNext = () => { if (!isLast) setStepIndex((i) => i + 1) }
  const goPrev = () => { if (!isFirst) setStepIndex((i) => i - 1) }

  const progress = ((stepIndex + 1) / total) * 100

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col text-white select-none">

      {/* Top bar */}
      <div className="px-5 pt-14 pb-4 flex items-center justify-between flex-shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center active:scale-90 transition-transform"
        >
          <X size={18} className="text-white" />
        </button>

        <div className="text-center flex-1 px-4">
          <p className="text-white/50 text-xs font-medium truncate">{recipe.title}</p>
          <p className="text-white font-semibold text-sm mt-0.5">Step {stepIndex + 1} of {total}</p>
          {screenAwake && (
            <p className="text-white/40 text-[10px] mt-0.5 flex items-center justify-center gap-1">
              <Sun size={10} /> Screen stays on
            </p>
          )}
        </div>

        {/* Cook Together toggle */}
        <button
          onClick={() => setCookTogether((c) => !c)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
            cookTogether ? 'bg-white text-gray-900' : 'bg-white/10 text-white/70'
          }`}
        >
          <Users size={13} />
          Together
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-5 mb-6 flex-shrink-0">
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        {/* Step dots */}
        <div className="flex gap-1.5 mt-2 justify-center flex-wrap">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setStepIndex(i)}
              className={`rounded-full transition-all ${
                i === stepIndex
                  ? 'w-5 h-2 bg-primary'
                  : i < stepIndex
                  ? 'w-2 h-2 bg-white/40'
                  : 'w-2 h-2 bg-white/15'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Main step content */}
      <div className="flex-1 px-5 flex flex-col">

        {/* Cook Together badge */}
        {cookTogether && (
          <div className={`self-start mb-4 flex items-center gap-2 px-3 py-1.5 rounded-full ${person.bg}`}>
            <span className="text-xs font-bold text-white">{person.name}'s turn</span>
          </div>
        )}

        {/* Step text */}
        <p className="text-white text-xl font-medium leading-relaxed flex-1">
          {stepText}
        </p>

        {ingredients.length > 0 && (
          <button
            onClick={() => setShowIngredients(true)}
            className="self-start mt-4 flex items-center gap-2 px-4 py-2.5 bg-white/10 rounded-full text-sm font-semibold text-white/80 active:scale-95 transition-transform"
          >
            <ListChecks size={15} />
            Ingredients
            {usedIngredients.size > 0 && (
              <span className="text-white/40 font-medium">{usedIngredients.size}/{ingredients.length}</span>
            )}
          </button>
        )}

        {/* Timer */}
        <div className="mt-6 bg-white/8 rounded-3xl p-5 border border-white/10">
          <div className="flex items-center gap-2 mb-4">
            <Timer size={15} className="text-white/50" />
            <span className="text-white/50 text-xs font-semibold uppercase tracking-wide">
              {timerSeconds > 0 && timerStep !== null && timerStep !== stepIndex
                ? `Timer from step ${timerStep + 1}`
                : 'Step Timer'}
            </span>
          </div>

          {timerSeconds > 0 ? (
            /* Countdown display */
            <div className="text-center mb-4">
              <span className={`font-mono text-5xl font-bold tabular-nums ${
                timerSeconds <= 10 && timerRunning ? 'text-rose-400' : 'text-white'
              }`}>
                {formatTime(timerSeconds)}
              </span>
            </div>
          ) : (
            <>
            {/* Times this step mentions — one tap starts the countdown */}
            {suggestedTimes.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {suggestedTimes.map((t) => (
                  <button
                    key={t.seconds}
                    onClick={() => startTimer(t.seconds)}
                    className="flex items-center gap-2 px-4 py-3 bg-primary rounded-xl text-sm font-semibold active:scale-95 transition-transform"
                  >
                    <Play size={14} />
                    Start {t.label}
                  </button>
                ))}
              </div>
            )}
            {/* Time input */}
            <div className="flex items-center gap-3 mb-4">
              <input
                type="number"
                placeholder="Minutes"
                value={timerInput}
                onChange={(e) => setTimerInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && startTypedTimer()}
                className="flex-1 bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white text-base font-semibold placeholder-white/30 outline-none focus:border-primary/60 text-center"
                min="0.5"
                step="0.5"
              />
              <button
                onClick={startTypedTimer}
                className={`px-5 py-3 rounded-xl font-semibold text-sm active:scale-95 transition-transform ${
                  suggestedTimes.length > 0 ? 'bg-white/10' : 'bg-primary'
                }`}
              >
                Set
              </button>
            </div>
            </>
          )}

          {/* Quick presets */}
          {timerSeconds === 0 && (
            <div className="flex gap-2 mb-4">
              {[1, 3, 5, 10, 15].map((min) => (
                <button
                  key={min}
                  onClick={() => { setTimerInput(String(min)); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                    timerInput === String(min)
                      ? 'bg-primary border-primary text-white'
                      : 'bg-white/8 border-white/15 text-white/60'
                  }`}
                >
                  {min}m
                </button>
              ))}
            </div>
          )}

          {/* Timer controls */}
          <div className="flex gap-2">
            {timerSeconds > 0 && (
              <>
                <button
                  onClick={pauseResumeTimer}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-white/10 rounded-xl text-sm font-semibold active:scale-95 transition-transform"
                >
                  {timerRunning ? <><Pause size={15} /> Pause</> : <><Play size={15} /> Resume</>}
                </button>
                <button
                  onClick={resetTimer}
                  className="py-3 px-4 bg-white/8 rounded-xl active:scale-95 transition-transform"
                >
                  <RotateCcw size={15} className="text-white/60" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="px-5 pt-4 pb-10 flex gap-3 flex-shrink-0">
        <button
          onClick={goPrev}
          disabled={isFirst}
          className="flex-1 flex items-center justify-center gap-2 py-4 bg-white/10 rounded-2xl font-semibold text-sm disabled:opacity-30 active:scale-[0.97] transition-all"
        >
          <ChevronLeft size={18} />
          Previous
        </button>

        <button
          onClick={isLast ? () => navigate(-1) : goNext}
          className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-sm active:scale-[0.97] transition-all ${
            isLast ? 'bg-sage' : 'bg-primary'
          }`}
        >
          {isLast ? 'Done! 🎉' : <>Next <ChevronRight size={18} /></>}
        </button>
      </div>

      {/* Ingredients sheet — so nobody has to leave Cooking Mode to check a quantity */}
      {showIngredients && (
        <div className="fixed inset-0 bg-black/60 flex items-end z-50" onClick={() => setShowIngredients(false)}>
          <div
            className="bg-gray-900 rounded-t-3xl w-full max-h-[75vh] flex flex-col border-t border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-4 pb-3 flex-shrink-0">
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-lg text-white">
                  Ingredients{scale !== 1 && <span className="text-white/40 text-sm font-sans font-medium"> · {scale}×</span>}
                </h3>
                <button
                  onClick={() => setShowIngredients(false)}
                  className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                >
                  <X size={15} className="text-white" />
                </button>
              </div>
              <p className="text-white/40 text-xs mt-1">Tap one to tick it off as you use it.</p>
            </div>
            <div className="overflow-y-auto px-5 pb-10">
              {ingredients.map((ing, i) => {
                const used = usedIngredients.has(i)
                return (
                  <button
                    key={i}
                    onClick={() => toggleIngredient(i)}
                    className="w-full flex items-center gap-3 py-3 border-b border-white/10 last:border-0 text-left"
                  >
                    <span className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                      used ? 'bg-sage border-sage' : 'border-white/30'
                    }`}>
                      {used && <Check size={12} className="text-white" />}
                    </span>
                    <span className={`text-sm font-medium min-w-[4.5rem] ${used ? 'text-white/25' : 'text-white/60'}`}>
                      {scaleAmount(ing.amount, scale)}
                    </span>
                    <span className={`text-base flex-1 ${used ? 'text-white/30 line-through' : 'text-white'}`}>
                      {ing.name}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CookingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
