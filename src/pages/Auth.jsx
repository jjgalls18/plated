import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { isSupabaseConfigured } from '../lib/supabase'
import toast from 'react-hot-toast'
import { ChefHat, Mail, Lock, User, Eye, EyeOff } from 'lucide-react'

export default function Auth() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signIn, signUp } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'signin') {
        await signIn(email, password)
        toast.success('Welcome back!')
      } else {
        await signUp(email, password, name)
        toast.success('Account created! Check your email to confirm.')
      }
    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-stone-900 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-8">
        <div className="mb-10 text-center">
          <div className="w-20 h-20 rounded-3xl bg-primary flex items-center justify-center mx-auto mb-5 shadow-soft">
            <ChefHat size={40} className="text-white" />
          </div>
          <h1 className="font-display text-5xl font-bold text-gray-900 dark:text-stone-50 mb-2">Plated</h1>
          <p className="text-warm-400 dark:text-stone-500 text-base font-medium">Your shared kitchen</p>
        </div>

        <div className="w-full max-w-sm bg-white dark:bg-stone-800 rounded-3xl shadow-card p-7">
          <h2 className="font-semibold text-gray-900 dark:text-stone-50 text-xl mb-6">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h2>

          {!isSupabaseConfigured && (
            <div className="mb-5 p-3.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl">
              <p className="text-amber-800 dark:text-amber-300 text-xs font-medium leading-relaxed">
                Running in demo mode — Supabase not connected.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="relative">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-400 dark:text-stone-500" />
                <input
                  type="text"
                  placeholder="Your first name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={mode === 'signup'}
                  className="w-full pl-11 pr-4 py-3.5 bg-warm-100 dark:bg-stone-700 rounded-2xl text-sm font-medium text-gray-900 dark:text-stone-50 placeholder-warm-400 dark:placeholder-stone-500 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                />
              </div>
            )}

            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-400 dark:text-stone-500" />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-11 pr-4 py-3.5 bg-warm-100 dark:bg-stone-700 rounded-2xl text-sm font-medium text-gray-900 dark:text-stone-50 placeholder-warm-400 dark:placeholder-stone-500 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
            </div>

            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-400 dark:text-stone-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-11 pr-11 py-3.5 bg-warm-100 dark:bg-stone-700 rounded-2xl text-sm font-medium text-gray-900 dark:text-stone-50 placeholder-warm-400 dark:placeholder-stone-500 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-warm-400 dark:text-stone-500"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-primary text-white font-semibold rounded-2xl text-sm shadow-soft hover:bg-primary-600 active:scale-[0.98] transition-all disabled:opacity-60 mt-2"
            >
              {loading ? 'Loading…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div className="mt-5 text-center">
            <button
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
              className="text-sm text-warm-400 dark:text-stone-500 hover:text-primary transition-colors"
            >
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <span className="font-semibold text-primary">
                {mode === 'signin' ? 'Sign up' : 'Sign in'}
              </span>
            </button>
          </div>
        </div>

        <p className="mt-8 text-xs text-warm-400 dark:text-stone-600 text-center max-w-xs">
          A shared recipe collection for two — save, cook, and discover together.
        </p>
      </div>
    </div>
  )
}
