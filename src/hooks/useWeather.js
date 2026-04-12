import { useState, useEffect } from 'react'

const BANGOR = { lat: 44.8012, lon: -68.7778, city: 'Bangor, ME' }
const CACHE_KEY = 'plated-weather'
const STALE_MS = 2 * 60 * 60 * 1000 // 2 hours

function getWeatherEmoji(code) {
  if (code === 0) return '☀️'
  if (code <= 2) return '🌤️'
  if (code === 3) return '☁️'
  if (code <= 48) return '🌫️'
  if (code <= 57) return '🌦️'
  if (code <= 67) return '🌧️'
  if (code <= 77) return '🌨️'
  if (code <= 82) return '🌦️'
  if (code <= 86) return '🌨️'
  return '⛈️'
}

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY))
  } catch {
    return null
  }
}

function writeCache(entry) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry))
  } catch {}
}

function isStale(entry) {
  return !entry || Date.now() - entry.ts > STALE_MS
}

async function getCoords(cachedLat, cachedLon) {
  // Reuse cached coords to avoid re-geocoding on every refresh
  if (cachedLat != null) return { lat: cachedLat, lon: cachedLon, city: null }

  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(BANGOR)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, city: null }),
      () => resolve(BANGOR),
      { timeout: 6000, maximumAge: 10 * 60 * 1000 }
    )
  })
}

async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    )
    if (!res.ok) return BANGOR.city
    const d = await res.json()
    const city = d.address?.city || d.address?.town || d.address?.village || d.address?.county
    const state = d.address?.state_code || d.address?.state
    return city ? `${city}${state ? `, ${state}` : ''}` : BANGOR.city
  } catch {
    return BANGOR.city
  }
}

async function fetchWeatherData(lat, lon) {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=auto`
  )
  if (!res.ok) throw new Error('Weather fetch failed')
  return res.json()
}

export function useWeather() {
  const [weather, setWeather] = useState(() => {
    // Initialise from cache immediately (even if stale) so UI isn't blank
    const cached = readCache()
    return cached ?? null
  })

  useEffect(() => {
    async function refresh() {
      const cached = readCache()

      // Fresh cache — just update state from it, no network call
      if (!isStale(cached)) {
        setWeather(cached)
        return
      }

      // Stale or missing — fetch. Reuse cached coords if we have them.
      const { lat, lon } = await getCoords(cached?.lat, cached?.lon)

      // Only geocode if we don't already have a city name stored
      const city = cached?.city ?? (await reverseGeocode(lat, lon))

      let temp, emoji
      try {
        const data = await fetchWeatherData(lat, lon)
        temp = Math.round(data.current.temperature_2m)
        emoji = getWeatherEmoji(data.current.weather_code)
      } catch {
        // Network failed — keep showing stale data if available
        return
      }

      const entry = { temp, emoji, city, lat, lon, ts: Date.now() }
      writeCache(entry)
      setWeather(entry)
    }

    // Run on mount (app open)
    refresh()

    // Run when app returns from background — only refetches if stale
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') refresh()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  return { weather }
}
