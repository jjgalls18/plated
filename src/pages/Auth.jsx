import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import toast from 'react-hot-toast'
import { ChefHat, Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react'

export default function Auth() {
  const [mode, setMode] = useState('signin') // 'signin' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const { signIn } = useAuth()

  const handleSignIn = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await signIn(email, password)
      toast.success('Welcome back!')
    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      if (error) throw error
      setResetSent(true)
    } catch (err) {
      toast.error(err.message || 'Could not send reset email')
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

          {mode === 'signin' && (
            <>
              <h2 className="font-semibold text-gray-900 dark:text-stone-50 text-xl mb-6">Welcome back</h2>

              {!isSupabaseConfigured && (
                <div className="mb-5 p-3.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl">
                  <p className="text-amber-800 dark:text-amber-300 text-xs font-medium leading-relaxed">
                    Running in demo mode — Supabase not connected.
                  </p>
                </div>
              )}

              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-400 dark:text-stone-500" />
                  <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
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
                    autoComplete="current-password"
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

                <div className="text-right -mt-1">
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setResetSent(false) }}
                    className="text-xs text-warm-400 dark:text-stone-500 hover:text-primary transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-primary text-white font-semibold rounded-2xl text-sm shadow-soft active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            </>
          )}

          {mode === 'forgot' && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => setMode('signin')}
                  className="w-8 h-8 bg-warm-100 dark:bg-stone-700 rounded-xl flex items-center justify-center"
                >
                  <ArrowLeft size={15} className="text-gray-600 dark:text-stone-300" />
                </button>
                <h2 className="font-semibold text-gray-900 dark:text-stone-50 text-xl">Reset password</h2>
              </div>

              {resetSent ? (
                <div className="text-center py-4">
                  <p className="text-4xl mb-4">📬</p>
                  <p className="font-semibold text-gray-900 dark:text-stone-50 mb-2">Check your email</p>
                  <p className="text-sm text-warm-400 dark:text-stone-500 leading-relaxed">
                    We sent a reset link to <span className="font-medium text-gray-700 dark:text-stone-300">{email}</span>. Click the link to set a new password.
                  </p>
                  <button
                    onClick={() => setMode('signin')}
                    className="mt-6 text-sm font-semibold text-primary"
                  >
                    Back to sign in
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <p className="text-sm text-warm-400 dark:text-stone-500 mb-2 leading-relaxed">
                    Enter your email and we'll send you a link to reset your password.
                  </p>
                  <div className="relative">
                    <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-400 dark:text-stone-500" />
                    <input
                      type="email"
                      placeholder="Email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="w-full pl-11 pr-4 py-3.5 bg-warm-100 dark:bg-stone-700 rounded-2xl text-sm font-medium text-gray-900 dark:text-stone-50 placeholder-warm-400 dark:placeholder-stone-500 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 bg-primary text-white font-semibold rounded-2xl text-sm shadow-soft active:scale-[0.98] transition-all disabled:opacity-60"
                  >
                    {loading ? 'Sending…' : 'Send reset link'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        <p className="mt-8 text-xs text-warm-400 dark:text-stone-600 text-center max-w-xs">
          A shared recipe collection for two — save, cook, and discover together.
        </p>
      </div>
    </div>
  )
}
