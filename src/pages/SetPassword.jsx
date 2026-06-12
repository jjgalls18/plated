import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import { ChefHat, Lock, Eye, EyeOff } from 'lucide-react'

export default function SetPassword() {
  const { updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password.length < 6) return toast.error('Password must be at least 6 characters')
    if (password !== confirm) return toast.error("Passwords don't match")
    setLoading(true)
    try {
      await updatePassword(password)
      toast.success('Password updated! Welcome back.')
    } catch (err) {
      toast.error(err.message || 'Could not update password')
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
          <h2 className="font-semibold text-gray-900 dark:text-stone-50 text-xl mb-2">Set new password</h2>
          <p className="text-sm text-warm-400 dark:text-stone-500 mb-6">Choose a new password for your account.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-400 dark:text-stone-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
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

            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-400 dark:text-stone-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full pl-11 pr-4 py-3.5 bg-warm-100 dark:bg-stone-700 rounded-2xl text-sm font-medium text-gray-900 dark:text-stone-50 placeholder-warm-400 dark:placeholder-stone-500 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-primary text-white font-semibold rounded-2xl text-sm shadow-soft active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {loading ? 'Saving…' : 'Set password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
