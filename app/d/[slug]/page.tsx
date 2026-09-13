'use client'
import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function DojangLandingPage() {
  const params = useParams()
  const slug = params.slug as string
  const supabase = createClient()

  const [dojang, setDojang] = useState<any>(null)
  const [practices, setPractices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    const load = async () => {
      setLoading(true)
      const { data: dojangData } = await supabase.from('dojangs').select('*').eq('slug', slug).single()
      setDojang(dojangData)

      if (dojangData) {
        const { data: practiceData } = await supabase
         .from('practices')
         .select('*')
         .eq('dojang_id', dojangData.id)
         .order('pinned', { ascending: false })
         .order('created_at', { ascending: false })
         .limit(20)
        setPractices(practiceData || [])
      }
      setLoading(false)
    }
    load()
  }, [slug])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading dojang...</div>
  }

  if (!dojang) {
    return <div className="min-h-screen flex items-center justify-center">Dojang not found: {slug}</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="p-6 text-white" style={{ backgroundColor: dojang.primary_color || '#0F4C8C' }}>
        <div className="max-w-xl mx-auto flex items-center gap-4">
          {dojang.logo_url && <img src={dojang.logo_url} className="w-12 h-12 rounded-full bg-white object-cover" alt="logo" />}
          <div>
            <h1 className="text-2xl font-black">{dojang.name}</h1>
            <p className="text-sm opacity-80">Taegeuk Poomsae Practice</p>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto p-5">
        {/* Record Button */}
        <Link
          href={`/d/${slug}/record`}
          className="block w-full p-5 rounded- font-black text-lg text-center text-white shadow-lg mb-6"
          style={{ backgroundColor: dojang.primary_color || '#0F4C8C' }}
        >
          + Record Taegeuk 1 Jang
        </Link>

        <div className="text-xs text-gray-400 mb-3 text-center">Videos auto-delete in 21 days unless saved • Compared to Master Skutt Gold Standard</div>

        {/* Practice History */}
        <div className="space-y-3">
          <h2 className="font-bold text-gray-700">Recent Practice</h2>
          {practices.length === 0 && (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
              No practices yet. Hit Record to start!
            </div>
          )}
          {practices.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl p-4 shadow-sm flex gap-4">
              <video src={p.video_url} className="w-24 h-24 rounded-xl object-cover bg-black" muted />
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-sm">{p.poomsae || 'Taegeuk 1 Jang'}</div>
                    <div className="text-xs text-gray-500">{new Date(p.created_at).toLocaleDateString()} • {p.pinned? 'Saved Forever ✓' : `Deletes ${new Date(p.expires_at).toLocaleDateString()}`}</div>
                  </div>
                  <div className="text-xl font-black" style={{ color: dojang.primary_color }}>{p.score || '--'}</div>
                </div>
                {p.breakdown?.perMovement && (
                  <div className="mt-2 text-xs text-amber-700 bg-amber-50 p-2 rounded-lg">
                    Focus: {p.breakdown.perMovement[0]?.issue?.slice(0, 60)}...
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}