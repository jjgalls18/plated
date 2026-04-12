import { NavLink, useLocation } from 'react-router-dom'
import { Home, BookOpen, Plus, CalendarDays, User } from 'lucide-react'

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/recipes', icon: BookOpen, label: 'Recipes' },
  { to: '/add', icon: Plus, label: 'Add', isPrimary: true },
  { to: '/meal-plan', icon: CalendarDays, label: 'Plan' },
  { to: '/profile', icon: User, label: 'Us' },
]

export default function BottomNav() {
  const location = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass shadow-nav h-nav">
      <div className="flex items-center justify-around h-[4.5rem] max-w-lg mx-auto px-2">
        {navItems.map(({ to, icon: Icon, label, isPrimary }) => {
          const isActive = to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(to)

          if (isPrimary) {
            return (
              <NavLink key={to} to={to} className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-soft transition-all duration-200 active:scale-90">
                  <Icon size={24} className="text-white" strokeWidth={2.5} />
                </div>
              </NavLink>
            )
          }

          return (
            <NavLink
              key={to}
              to={to}
              className="flex flex-col items-center gap-1 min-w-[3rem] py-1"
            >
              <Icon
                size={22}
                strokeWidth={isActive ? 2.5 : 1.8}
                className={`transition-colors duration-200 ${
                  isActive ? 'text-primary' : 'text-stone-400 dark:text-stone-500'
                }`}
              />
              <span
                className={`text-[10px] font-medium transition-colors duration-200 ${
                  isActive ? 'text-primary' : 'text-stone-400 dark:text-stone-500'
                }`}
              >
                {label}
              </span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
