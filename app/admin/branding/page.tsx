'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function BrandingAdmin() {
  const supabase = createClient()
  const [dojang, setDojang] = useState<any>({})
  const slug = 'midland-tkd' // for now you, later from auth

  useEffect(() => {
    supabase.from('dojangs').select('*').eq('slug', slug).single().then(({data}) => setDojang(data))
  }, [])

  const save = async () => {
    await supabase.from('dojangs').update({
      name: dojang.name,
      primary_color: dojang.primary_color,
      secondary_color: dojang.secondary_color,
      accent_color: dojang.accent_color
    }).eq('slug', slug)
    alert('Branding saved! Refresh student view.')
  }

  const uploadLogo = async (e: any) => {
    const file = e.target.files[0]
    const { data } = await supabase.storage.from('dojang-assets').upload(`${slug}/logo-${Date.now()}.png`, file)
    const { data: urlData } = supabase.storage.from('dojang-assets').getPublicUrl(data!.path)
    setDojang({...dojang, logo_url: urlData.publicUrl})
  }

  return (
    <div className="max-w-xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-bold">Dojang Branding Admin</h1>

      <label>Dojang Name <input value={dojang.name} onChange={e=>setDojang({...dojang, name:e.target.value})} className="w-full border p-2 rounded" /></label>

      <label>Logo <input type="file" onChange={uploadLogo} /></label>
      {dojang.logo_url && <img src={dojang.logo_url} className="h-20" />}

      <div className="grid grid-cols-3 gap-4">
        <label>Primary <input type="color" value={dojang.primary_color} onChange={e=>setDojang({...dojang, primary_color:e.target.value})} /></label>
        <label>Secondary <input type="color" value={dojang.secondary_color} onChange={e=>setDojang({...dojang, secondary_color:e.target.value})} /></label>
        <label>Accent <input type="color" value={dojang.accent_color} onChange={e=>setDojang({...dojang, accent_color:e.target.value})} /></label>
      </div>

      <div className="p-4 rounded border" style={{background: dojang.primary_color, color: 'white'}}>
        Live Preview: {dojang.name} header
      </div>

      <button onClick={save} className="bg-black text-white px-6 py-3 rounded font-bold w-full">Save Branding</button>
      <p className="text-xs text-gray-500">Future purchasers get this same page but only for their slug. You stay super-admin.</p>
    </div>
  )
}