export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DojangPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: dojang } = await supabase.from('dojangs').select('*').eq('slug', slug).single()

  if (!dojang) return <div className="p-8">Dojang not found: {slug}</div>

  return (
    <div className="p-5 max-w-xl mx-auto space-y-5">
      {/* Hero - uses primary */}
      <div className="p-6 rounded- text-white shadow-lg" style={{backgroundColor: 'var(--dojang-primary)'}}>
        <p className="text-xs opacity-80 tracking-widest uppercase">Taegeuk 1 Jang • Level 1</p>
        <h2 className="text-3xl font-black mt-1">Ready to Train?</h2>
        <p className="text-sm opacity-90 mt-2">3 practices this week. 2 more for your stripe.</p>
        <div className="mt-4 bg-white/20 rounded-full h-2 overflow-hidden">
          <div className="h-full bg-white rounded-full" style={{width: '60%'}}></div>
        </div>
      </div>

      {/* Primary CTA - uses primary */}
<Link href={`/d/${slug}/record`} className="block w-full">
  <button className="w-full p-5 rounded-[20px] font-black text-lg text-white shadow-xl active:scale-[0.98] transition" style={{backgroundColor: 'var(--dojang-secondary)'}}>
    🎥 Record Taegeuk 1
  </button>
</Link>

      {/* Stats - uses accent */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border rounded- p-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔥</span>
            <span className="font-black text-xl" style={{color: 'var(--dojang-accent)'}}>3 Day</span>
          </div>
          <div className="text- text-gray-500 uppercase tracking-widest">Streak</div>
        </div>
        <div className="bg-white border rounded- p-4">
          <div className="font-black text-xl" style={{color: 'var(--dojang-primary)'}}>Next: Stripe</div>
          <div className="text- text-gray-500 uppercase tracking-widest">Reward at 5</div>
        </div>
      </div>

      {/* Quest Map */}
      <div className="bg-white border rounded- p-5">
        <h3 className="font-bold">Quest Map</h3>
        <div className="flex gap-3 mt-4 overflow-x-auto pb-2">
          <div className="min-w- p-3 rounded-xl text-white text-center" style={{backgroundColor: 'var(--dojang-primary)'}}>
            <div className="text-2xl">1</div><div className="text-">Taegeuk 1</div><div className="text- mt-1 bg-white/20 rounded-full">ACTIVE</div>
          </div>
          {[2,3,4,5,6,7,8].map(n => (
            <div key={n} className="min-w- p-3 rounded-xl bg-gray-100 text-center opacity-60">
              <div className="text-2xl">{n}</div><div className="text-">Taegeuk {n}</div><div className="text- mt-1">LOCKED</div>
            </div>
          ))}
        </div>
      </div>

      <Link href="/admin/branding" className="block text-center text-xs text-gray-400 underline">Go to Branding Admin</Link>
    </div>
  )
}