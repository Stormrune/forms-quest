'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function BrandingAdmin() {
  const supabase = createClient()
  const [dojangs, setDojangs] = useState<any[]>([])
  const [slug, setSlug] = useState('midland-tkd')
  const [dojang, setDojang] = useState<any>({})

  useEffect(() => {
    supabase.from('dojangs').select('*').then(({data}) => setDojangs(data || []))
  }, [])

  useEffect(() => {
    supabase.from('dojangs').select('*').eq('slug', slug).single().then(({data}) => setDojang(data))
  }, [slug])

const save = async () => {
  const { error, count } = await supabase.from('dojangs').update({
    name: dojang.name,
    primary_color: dojang.primary_color,
    secondary_color: dojang.secondary_color,
    accent_color: dojang.accent_color,
    logo_url: dojang.logo_url
  }).eq('slug', slug)

  if (error) {
    alert('Save failed: ' + error.message)
    console.error(error)
  } else {
    alert(`Saved! Check Supabase table now. Go to /d/${slug} and hard refresh.`)
  }
}

const uploadLogo = async (e: any) => {
  const file = e.target.files[0]
  if (!file) return
  const path = `${slug}/logo-${Date.now()}.png`
  const { data, error } = await supabase.storage.from('dojang-assets').upload(path, file, { upsert: true })
  
  if (error) {
    alert('Upload failed: ' + error.message)
    console.error(error)
    return
  }
  
  const { data: urlData } = supabase.storage.from('dojang-assets').getPublicUrl(data.path)
  console.log('Logo URL:', urlData.publicUrl)
  setDojang({...dojang, logo_url: urlData.publicUrl})
}

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-black">Dojang Branding Admin</h1>

      <select value={slug} onChange={e=>setSlug(e.target.value)} className="w-full border p-3 rounded-xl">
        {dojangs.map(d => <option key={d.slug} value={d.slug}>{d.name} ({d.slug})</option>)}
      </select>

      <label className="block">Dojang Name
        <input value={dojang.name || ''} onChange={e=>setDojang({...dojang, name:e.target.value})} className="w-full border p-3 rounded-xl mt-1" />
      </label>

      <label className="block">Logo
        <input type="file" onChange={uploadLogo} className="mt-1" />
        {dojang.logo_url && <img src={dojang.logo_url} className="h-24 w-24 rounded-full mt-3 object-cover border" />}
      </label>

      <div className="grid grid-cols-3 gap-4">
        <label>Primary <input type="color" value={dojang.primary_color || '#0F4C8C'} onChange={e=>setDojang({...dojang, primary_color:e.target.value})} className="w-full h-12" /></label>
        <label>Secondary <input type="color" value={dojang.secondary_color || '#0A0A0A'} onChange={e=>setDojang({...dojang, secondary_color:e.target.value})} className="w-full h-12" /></label>
        <label>Accent <input type="color" value={dojang.accent_color || '#E53935'} onChange={e=>setDojang({...dojang, accent_color:e.target.value})} className="w-full h-12" /></label>
      </div>

      <div className="p-6 rounded-2xl text-white" style={{backgroundColor: dojang.primary_color}}>
        Live Preview Header: {dojang.name}
      </div>

      <button onClick={save} className="bg-black text-white px-6 py-4 rounded-xl font-black w-full">Save Branding</button>

      <a href={`/d/${slug}`} target="_blank" className="block text-center border p-3 rounded-xl">Open /d/{slug} to see it live →</a>
    </div>
  )
}