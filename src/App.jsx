import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { queryClient } from './lib/queryClient'
import { useAuth } from './hooks/useAuth'
import { useAppStore } from './stores/useAppStore'
import AppShell from './components/layout/AppShell'
import ErrorBoundary from './components/ErrorBoundary'
import Home from './pages/Home'
import Auth from './pages/Auth'
import LoadingScreen from './components/ui/LoadingScreen'
import SetPassword from './pages/SetPassword'

// Code-split everything past the landing screen — keeps the initial mobile
// bundle to just what's needed for first paint (auth + home).
const Recipes = lazy(() => import('./pages/Recipes'))
const Search = lazy(() => import('./pages/Search'))
const AddRecipe = lazy(() => import('./pages/AddRecipe'))
const RecipeDetail = lazy(() => import('./pages/RecipeDetail'))
const CookingMode = lazy(() => import('./pages/CookingMode'))
const MealPlan = lazy(() => import('./pages/MealPlan'))
const Grocery = lazy(() => import('./pages/Grocery'))
const ShopMode = lazy(() => import('./pages/ShopMode'))
const Assistant = lazy(() => import('./pages/Assistant'))
const Queue = lazy(() => import('./pages/Queue'))
const Profile = lazy(() => import('./pages/Profile'))
const AdminScreen = lazy(() => import('./pages/AdminScreen'))
const EditRecipe = lazy(() => import('./pages/EditRecipe'))

function AppRoutes() {
  const { user, loading, recoveryMode } = useAuth()

  if (loading) return <LoadingScreen />
  if (recoveryMode) return <SetPassword />
  if (!user) return <Auth />

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* Full-screen — no bottom nav */}
        <Route path="/recipe/:id/cook" element={<CookingMode />} />
        <Route path="/recipe/:id/edit" element={<EditRecipe />} />
        <Route path="/grocery/shop" element={<ShopMode />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/admin" element={<AdminScreen />} />

        {/* Standard shell routes */}
        <Route path="/" element={<AppShell><Home /></AppShell>} />
        <Route path="/recipes" element={<AppShell><Recipes /></AppShell>} />
        <Route path="/search" element={<AppShell><Search /></AppShell>} />
        <Route path="/add" element={<AppShell><AddRecipe /></AppShell>} />
        <Route path="/recipe/:id" element={<AppShell><RecipeDetail /></AppShell>} />
        <Route path="/meal-plan" element={<AppShell><MealPlan /></AppShell>} />
        <Route path="/grocery" element={<AppShell><Grocery /></AppShell>} />
        <Route path="/queue" element={<AppShell><Queue /></AppShell>} />
        <Route path="/profile" element={<AppShell><Profile /></AppShell>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
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
        <ErrorBoundary>
          <AppRoutes />
        </ErrorBoundary>
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
