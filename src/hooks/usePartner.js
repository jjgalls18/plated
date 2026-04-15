import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from './useAuth'

export function usePartner() {
  const { user } = useAuth()
  const [inviteCode, setInviteCode] = useState(null)
  const [partner, setPartner] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !isSupabaseConfigured) { setLoading(false); return }

    const load = async () => {
      // Fetch own profile for invite code + partner_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('invite_code, partner_id')
        .eq('id', user.id)
        .single()

      if (profile) {
        let code = profile.invite_code

        // Auto-generate a code if missing
        if (!code) {
          code = Math.random().toString(36).substring(2, 10).toUpperCase()
          await supabase
            .from('profiles')
            .update({ invite_code: code })
            .eq('id', user.id)
        }

        setInviteCode(code)

        // If already linked, fetch partner profile
        if (profile.partner_id) {
          const { data: partnerProfile } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url')
            .eq('id', profile.partner_id)
            .single()
          setPartner(partnerProfile)
        }
      }
      setLoading(false)
    }

    load()
  }, [user])

  const joinWithCode = async (code) => {
    if (!user || !isSupabaseConfigured) throw new Error('Not connected')

    const trimmed = code.trim().toLowerCase()

    // Find the profile with this invite code
    const { data: otherProfile, error } = await supabase
      .from('profiles')
      .select('id, display_name, partner_id')
      .eq('invite_code', trimmed)
      .single()

    if (error || !otherProfile) throw new Error('Invite code not found — double check and try again')
    if (otherProfile.id === user.id) throw new Error("That's your own code!")
    if (otherProfile.partner_id) throw new Error('This code has already been used')

    // Link both profiles to each other
    const { error: e1 } = await supabase
      .from('profiles')
      .update({ partner_id: otherProfile.id })
      .eq('id', user.id)

    if (e1) throw new Error('Failed to link accounts')

    const { error: e2 } = await supabase
      .from('profiles')
      .update({ partner_id: user.id })
      .eq('id', otherProfile.id)

    if (e2) throw new Error('Failed to link partner account')

    setPartner(otherProfile)
    return otherProfile
  }

  const unlinkPartner = async () => {
    if (!user || !partner || !isSupabaseConfigured) return

    await supabase.from('profiles').update({ partner_id: null }).eq('id', user.id)
    await supabase.from('profiles').update({ partner_id: null }).eq('id', partner.id)
    setPartner(null)
  }

  return { inviteCode, partner, loading, joinWithCode, unlinkPartner }
}
