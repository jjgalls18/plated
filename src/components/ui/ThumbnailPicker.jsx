import { useRef, useState } from 'react'
import { Camera, ImagePlus, Loader } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { uploadRecipeImage } from '../../lib/storage'
import toast from 'react-hot-toast'

/**
 * ThumbnailPicker
 * Shows the current thumbnail (or a placeholder) and lets the user
 * tap to pick a photo from their library / camera.
 *
 * Props:
 *   url      — current thumbnail URL (string | null)
 *   onChange — called with the new public URL after upload
 *   compact  — if true, renders as a small inline button instead of full hero
 */
export default function ThumbnailPicker({ url, onChange, compact = false }) {
  const { user } = useAuth()
  const fileRef = useRef()
  const [uploading, setUploading] = useState(false)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const publicUrl = await uploadRecipeImage(file, user?.id || 'anon')
      onChange(publicUrl)
    } catch (err) {
      toast.error('Upload failed — check storage bucket is set up')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const open = () => fileRef.current?.click()

  if (compact) {
    return (
      <>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        <button
          type="button"
          onClick={open}
          disabled={uploading}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary active:scale-95 transition-transform disabled:opacity-50"
        >
          {uploading
            ? <><Loader size={13} className="animate-spin" /> Uploading…</>
            : <><Camera size={13} /> {url ? 'Replace photo' : 'Add photo'}</>
          }
        </button>
      </>
    )
  }

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      <button
        type="button"
        onClick={open}
        disabled={uploading}
        className="w-full relative rounded-2xl overflow-hidden shadow-card active:opacity-80 transition-opacity disabled:opacity-50"
        style={{ aspectRatio: '16/9' }}
      >
        {url ? (
          <>
            <img src={url} alt="Recipe thumbnail" className="w-full h-full object-cover" />
            {/* Overlay hint */}
            <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center">
              {uploading
                ? <div className="bg-black/60 rounded-full px-3 py-1.5 flex items-center gap-2">
                    <Loader size={14} className="text-white animate-spin" />
                    <span className="text-white text-xs font-semibold">Uploading…</span>
                  </div>
                : <div className="opacity-0 hover:opacity-100 transition-opacity bg-black/60 rounded-full px-3 py-1.5 flex items-center gap-2">
                    <Camera size={14} className="text-white" />
                    <span className="text-white text-xs font-semibold">Replace photo</span>
                  </div>
              }
            </div>
          </>
        ) : (
          <div className="w-full h-full bg-warm-100 dark:bg-stone-800 flex flex-col items-center justify-center gap-2">
            {uploading ? (
              <>
                <Loader size={28} className="text-primary animate-spin" />
                <p className="text-xs font-semibold text-warm-400 dark:text-stone-500">Uploading…</p>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <ImagePlus size={26} className="text-primary" />
                </div>
                <p className="text-sm font-semibold text-gray-700 dark:text-stone-300">Add a photo</p>
                <p className="text-xs text-warm-400 dark:text-stone-500">Tap to take or upload</p>
              </>
            )}
          </div>
        )}
      </button>
    </>
  )
}
