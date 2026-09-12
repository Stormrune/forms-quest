import { createClient } from '@/lib/supabase/server'

export default async function DojangPage({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: dojang } = await supabase.from('dojangs').select('*').eq('slug', slug).single()

  if (!dojang) {
    return (
      <div className="p-8">
        <h1 className="font-bold">Dojang not found: {slug}</h1>
        <p className="text-sm text-gray-500 mt-2">Go to Supabase -`&gt;` Table Editor -`&gt;` dojangs and make sure you have a row with slug = '{slug}'</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <div className="p-6 rounded-2xl text-white" style={{backgroundColor: 'var(--dojang-primary)'}}>
        <h2 className="text-2xl font-black">Taegeuk 1 Quest</h2>
        <p className="opacity-90">Welcome to {dojang.name}</p>
      </div>

      <button className="w-full bg-black text-white p-4 rounded-xl font-bold text-lg">
        🎥 Record Taegeuk 1
      </button>

      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded-xl p-4">
          <div className="text-2xl">🔥 3</div>
          <div className="text-xs text-gray-500">Day Streak</div>
        </div>
        <div className="border rounded-xl p-4">
          <div className="text-2xl">Next: Stripe</div>
          <div className="text-xs text-gray-500">2 more practices</div>
        </div>
      </div>

      <div className="border rounded-xl p-4">
        <p className="text-sm">If you see this page, routing is working. Branding color above should match what you set in /admin/branding</p>
      </div>
    </div>
  )
}