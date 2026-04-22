import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { queryClient } from './lib/queryClient'
import { useAuth } from './hooks/useAuth'
import { useAppStore } from './stores/useAppStore'
import AppShell from './components/layout/AppShell'
import Home from './pages/Home'
import Recipes from './pages/Recipes'
import Search from './pages/Search'
import AddRecipe from './pages/AddRecipe'
import RecipeDetail from './pages/RecipeDetail'
import CookingMode from './pages/CookingMode'
import MealPlan from './pages/MealPlan'
import Grocery from './pages/Grocery'
import Profile from './pages/Profile'
import Auth from './pages/Auth'
import AdminScreen from './pages/AdminScreen'
import EditRecipe from './pages/EditRecipe'
import LoadingScreen from './components/ui/LoadingScreen'

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return <Auth />

  return (
    <Routes>
      {/* Full-screen — no bottom nav */}
      <Route path="/recipe/:id/cook" element={<CookingMode />} />
      <Route path="/recipe/:id/edit" element={<EditRecipe />} />
      <Route path="/admin" element={<AdminScreen />} />

      {/* Standard shell routes */}
      <Route path="/" element={<AppShell><Home /></AppShell>} />
      <Route path="/recipes" element={<AppShell><Recipes /></AppShell>} />
      <Route path="/search" element={<AppShell><Search /></AppShell>} />
      <Route path="/add" element={<AppShell><AddRecipe /></AppShell>} />
      <Route path="/recipe/:id" element={<AppShell><RecipeDetail /></AppShell>} />
      <Route path="/meal-plan" element={<AppShell><MealPlan /></AppShell>} />
      <Route path="/grocery" element={<AppShell><Grocery /></AppShell>} />
      <Route path="/profile" element={<AppShell><Profile /></AppShell>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function ThemeProvider() {
  const darkMode = useAppStore((s) => s.darkMode)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])
  return null
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider />
        <AppRoutes />
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#1A1A1A',
              color: '#fff',
              borderRadius: '12px',
              fontSize: '14px',
              fontFamily: 'Inter, sans-serif',
              padding: '12px 16px',
            },
            success: {
              iconTheme: { primary: '#5C7A5F', secondary: '#fff' },
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
