import { supabase } from './supabase'

export async function uploadRecipeImage(file, userId) {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${userId}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('recipe-images')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (error) throw error

  const { data } = supabase.storage
    .from('recipe-images')
    .getPublicUrl(path)

  return data.publicUrl
}
