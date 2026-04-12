import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { X, ChevronLeft, ChevronRight, Timer, Play, Pause, RotateCcw, Users } from 'lucide-react'
import { useRecipe } from '../hooks/useRecipes'
import { MOCK_USER } from '../data/mockRecipes'
import toast from 'react-hot-toast'

const PERSON1 = { name: MOCK_USER.display_name, bg: 'bg-primary', text: 'text-white' }
const PERSON2 = { name: MOCK_USER.partner_name,  bg: 'bg-sage',    text: 'text-white' }

function getPerson(index) {
  return index % 2 === 0 ? PERSON1 : PERSON2
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function CookingMode() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: recipe, isLoading } = useRecipe(id)

  const [stepIndex, setStepIndex] = useState(0)
  const [cookTogether, setCookTogether] = useState(false)

  // Timer state
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerInput, setTimerInput] = useState('')
  const intervalRef = useRef(null)

  // Reset timer when step changes
  useEffect(() => {
    clearInterval(intervalRef.current)
    setTimerRunning(false)
    setTimerSeconds(0)
    setTimerInput('')
  }, [stepIndex])

  // Tick
  useEffect(() => {
    if (timerRunning) {
      intervalRef.current = setInterval(() => {
        setTimerSeconds((s) => {
          if (s <= 1) {
            clearInterval(intervalRef.current)
            setTimerRunning(false)
            toast('⏰ Timer done!', {
              duration: 5000,
              style: { background: '#C4622D', color: '#fff', fontWeight: '600' },
            })
            return 0
          }
          return s - 1
        })
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [timerRunning])

  const startTimer = () => {
    const mins = parseFloat(timerInput)
    if (!timerInput || isNaN(mins) || mins <= 0) {
      toast.error('Enter a time in minutes first')
      return
    }
    setTimerSeconds(Math.round(mins * 60))
    setTimerInput('')
    setTimerRunning(true)
  }

  const pauseResumeTimer = () => setTimerRunning((r) => !r)

  const resetTimer = () => {
    clearInterval(intervalRef.current)
    setTimerRunning(false)
    setTimerSeconds(0)
    setTimerInput('')
  }

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
          {current}
        </p>

        {/* Timer */}
        <div className="mt-6 bg-white/8 rounded-3xl p-5 border border-white/10">
          <div className="flex items-center gap-2 mb-4">
            <Timer size={15} className="text-white/50" />
            <span className="text-white/50 text-xs font-semibold uppercase tracking-wide">Step Timer</span>
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
            /* Time input */
            <div className="flex items-center gap-3 mb-4">
              <input
                type="number"
                placeholder="Minutes"
                value={timerInput}
                onChange={(e) => setTimerInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && startTimer()}
                className="flex-1 bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white text-base font-semibold placeholder-white/30 outline-none focus:border-primary/60 text-center"
                min="0.5"
                step="0.5"
              />
              <button
                onClick={startTimer}
                className="bg-primary px-5 py-3 rounded-xl font-semibold text-sm active:scale-95 transition-transform"
              >
                Set
              </button>
            </div>
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
