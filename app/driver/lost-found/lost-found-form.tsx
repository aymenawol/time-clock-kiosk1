'use client'

import { useState, useTransition } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const LOCATIONS = [
  'On Bus',
  'T-1',
  'T-3 West',
  'T-3 East',
  'RAC',
  'Other',
] as const

interface Props {
  employeeId: string
  busId: string | null
  busNumber: string
}

export default function LostFoundForm({ employeeId, busId, busNumber }: Props) {
  const [description, setDescription]   = useState('')
  const [location, setLocation]         = useState<string>('On Bus')
  const [isBag, setIsBag]               = useState(false)
  const [bagContents, setBagContents]   = useState('')
  const [photos, setPhotos]             = useState<File[]>([])
  const [submitted, setSubmitted]       = useState(false)
  const [isPending, startTransition]    = useTransition()
  const [error, setError]               = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const valid = files.filter(f => {
      if (f.size > 10 * 1024 * 1024) return false
      return ['image/jpeg', 'image/png', 'image/heic'].includes(f.type)
    })
    setPhotos(prev => [...prev, ...valid].slice(0, 5))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    if (!busId) { setError('No bus assigned to your current shift'); return }

    setError(null)
    startTransition(async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      // Upload photos first
      const photoPaths: string[] = []
      const itemTempId = crypto.randomUUID()

      for (let i = 0; i < photos.length; i++) {
        const file = photos[i]
        const ext  = file.name.split('.').pop() ?? 'jpg'
        const path = `${itemTempId}/${i}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('lost-and-found')
          .upload(path, file)
        if (upErr) { setError(`Photo upload failed: ${upErr.message}`); return }
        photoPaths.push(path)
        setUploadProgress(Math.round(((i + 1) / photos.length) * 80))
      }

      setUploadProgress(90)

      // Insert record
      const { error: dbErr } = await supabase.from('lost_items').insert({
        bus_id:           busId,
        reported_by:      employeeId,
        item_description: description.trim(),
        location_found:   location,
        is_bag:           isBag,
        bag_contents:     isBag ? bagContents.trim() : null,
        photo_paths:      photoPaths,
        status:           'found',
      })

      if (dbErr) { setError(dbErr.message); return }
      setUploadProgress(100)
      setSubmitted(true)
    })
  }

  if (submitted) {
    return (
      <div className="bg-green-950/50 border border-green-700 rounded-xl p-8 text-center">
        <div className="text-green-400 text-5xl mb-4">✓</div>
        <h2 className="text-foreground font-bold text-xl mb-2">Item Reported</h2>
        <p className="text-foreground mb-1">{description}</p>
        <p className="text-muted-foreground text-sm">Location: {location} · Bus {busNumber}</p>
        <p className="text-muted-foreground text-sm mt-4">Dispatch has been notified.</p>
        <button
          onClick={() => {
            setSubmitted(false); setDescription(''); setLocation('On Bus')
            setIsBag(false); setBagContents(''); setPhotos([]); setUploadProgress(0)
          }}
          className="mt-6 text-muted-foreground hover:text-foreground text-sm underline"
        >
          Report another item
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm text-muted-foreground mb-1">Bus Number</label>
        <div className="bg-muted border border-border rounded-xl px-4 py-3 text-foreground">{busNumber}</div>
      </div>

      <div>
        <label className="block text-sm text-muted-foreground mb-1">Item Description <span className="text-red-400">*</span></label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          required
          rows={3}
          placeholder="Describe the item found…"
          className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-none"
        />
      </div>

      <div>
        <label className="block text-sm text-muted-foreground mb-1">Where was it found?</label>
        <select
          value={location}
          onChange={e => setLocation(e.target.value)}
          className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-gray-500"
        >
          {LOCATIONS.map(l => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsBag(!isBag)}
          className={`w-12 h-6 rounded-full transition-colors ${isBag ? 'bg-blue-600' : 'bg-gray-700'} relative`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isBag ? 'translate-x-6' : ''}`} />
        </button>
        <label className="text-sm text-foreground cursor-pointer" onClick={() => setIsBag(!isBag)}>
          This is a bag / backpack / luggage
        </label>
      </div>

      {isBag && (
        <div>
          <label className="block text-sm text-muted-foreground mb-1">Bag Contents <span className="text-red-400">*</span></label>
          <textarea
            value={bagContents}
            onChange={e => setBagContents(e.target.value)}
            required={isBag}
            rows={3}
            placeholder="Describe what the bag contains (for security)…"
            className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-none"
          />
        </div>
      )}

      <div>
        <label className="block text-sm text-muted-foreground mb-1">Photos (optional, max 5)</label>
        <div className="border-2 border-dashed border-border rounded-xl p-4 text-center">
          <input
            type="file"
            accept="image/jpeg,image/png,image/heic"
            multiple
            onChange={handlePhotoChange}
            className="hidden"
            id="photo-input"
          />
          <label htmlFor="photo-input" className="cursor-pointer text-muted-foreground hover:text-foreground text-sm">
            {photos.length === 0 ? (
              <span>Tap to add photos (JPEG / PNG / HEIC, max 10 MB each)</span>
            ) : (
              <span>{photos.length} photo{photos.length > 1 ? 's' : ''} selected</span>
            )}
          </label>
        </div>
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {photos.map((f, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={URL.createObjectURL(f)}
                  alt=""
                  className="w-16 h-16 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => setPhotos(p => p.filter((_, j) => j !== i))}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-foreground rounded-full text-xs flex items-center justify-center"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {isPending && uploadProgress > 0 && uploadProgress < 100 && (
        <div>
          <div className="text-xs text-muted-foreground mb-1">Uploading… {uploadProgress}%</div>
          <div className="bg-muted rounded-full h-1.5">
            <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={isPending || !description.trim() || (isBag && !bagContents.trim())}
        className="w-full bg-blue-600 hover:bg-blue-500 text-foreground font-bold py-4 rounded-xl text-lg disabled:opacity-40 transition-colors"
      >
        {isPending ? 'Submitting…' : 'Submit Lost & Found Report'}
      </button>
    </form>
  )
}
