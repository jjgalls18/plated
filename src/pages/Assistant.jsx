import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, ChefHat, Sparkles } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { authHeaders } from '../lib/extraction'
import { computeCost } from '../lib/aiCost'
import toast from 'react-hot-toast'

const MODEL = 'claude-sonnet-5'

const STARTERS = [
  "What can I make with chicken thighs and rice?",
  "How do I know when steak is medium-rare?",
  "My sauce broke — how do I fix it?",
  "What's a good side for salmon?",
]

export default function Assistant() {
  const navigate = useNavigate()
  const { anthropicApiKey, aiEnabled, logAiCost } = useAppStore()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  const ready = anthropicApiKey && aiEnabled

  const send = async (text) => {
    const question = (text ?? input).trim()
    if (!question || sending) return
    setInput('')
    const nextMessages = [...messages, { role: 'user', content: question }]
    setMessages(nextMessages)
    setSending(true)

    try {
      const res = await fetch('/api/anthropic', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({
          apiKey: anthropicApiKey,
          model: MODEL,
          max_tokens: 600,
          system: 'You are Plated\'s cooking assistant — warm, brief, and practical. Answer cooking questions, suggest recipes and substitutions, and give techniques. Keep answers conversational and skimmable, a few short paragraphs or a tight list, not an essay.',
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error?.message || 'Could not reach the assistant')
      }
      const data = await res.json()
      logAiCost?.(computeCost(MODEL, data.usage), 'cooking_assistant')
      const reply = data.content?.[0]?.text?.trim() || "Sorry, I didn't catch that — try again?"
      setMessages((m) => [...m, { role: 'assistant', content: reply }])
    } catch (err) {
      toast.error(err.message || 'Something went wrong')
      setMessages((m) => m.slice(0, -1))
      setInput(question)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-stone-900 flex flex-col">
      <div className="px-5 pt-14 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center shadow-card">
          <ArrowLeft size={18} className="text-gray-700 dark:text-stone-300" />
        </button>
        <div>
          <h1 className="font-display text-xl font-bold text-gray-900 dark:text-stone-50">Cooking Assistant</h1>
          <p className="text-xs text-warm-400 dark:text-stone-500">Ask anything about what's for dinner</p>
        </div>
      </div>

      {!ready ? (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <div className="w-16 h-16 rounded-3xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mb-4">
            <Sparkles size={28} className="text-primary" />
          </div>
          <p className="font-semibold text-gray-700 dark:text-stone-300 mb-1">
            {aiEnabled ? 'Add your Anthropic API key' : 'AI is turned off'}
          </p>
          <p className="text-sm text-warm-400 dark:text-stone-500">
            Tap the Plated logo 5× → Controls to {aiEnabled ? 'add a key' : 'turn AI on'}, then come back.
          </p>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-3">
            {messages.length === 0 && (
              <div className="pt-6">
                <p className="text-xs font-semibold text-warm-400 dark:text-stone-500 uppercase tracking-wide mb-3">Try asking</p>
                <div className="grid grid-cols-1 gap-2">
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-left px-4 py-3 bg-white dark:bg-stone-800 rounded-2xl shadow-card text-sm text-gray-700 dark:text-stone-300 active:scale-[0.98] transition-transform"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-primary text-white rounded-br-md'
                    : 'bg-white dark:bg-stone-800 text-gray-800 dark:text-stone-200 shadow-card rounded-bl-md'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-stone-800 shadow-card rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                  <ChefHat size={14} className="text-primary animate-pulse" />
                  <span className="text-xs text-warm-400 dark:text-stone-500">thinking…</span>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); send() }}
            className="px-5 pb-6 pt-2 flex gap-2 bg-cream dark:bg-stone-900"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a cooking question…"
              className="flex-1 px-4 py-3 bg-white dark:bg-stone-800 rounded-2xl text-sm text-gray-900 dark:text-stone-50 placeholder-warm-400 dark:placeholder-stone-500 shadow-card outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-soft active:scale-90 transition-transform disabled:opacity-50 flex-shrink-0"
            >
              <Send size={18} className="text-white" />
            </button>
          </form>
        </>
      )}
    </div>
  )
}
