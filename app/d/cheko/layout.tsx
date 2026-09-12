import { createClient } from '@/lib/supabase/server'

export default async function DojangLayout({ params, children }: { params: { slug: string }, children: React.ReactNode }) {
  const supabase = createClient()
  const { data: dojang } = await supabase.from('dojangs').select('*').eq('slug', params.slug).single()

  if (!dojang) return <div>Dojang not found</div>

  return (
    <div style={{
      '--dojang-primary': dojang.primary_color,
      '--dojang-secondary': dojang.secondary_color,
      '--dojang-accent': dojang.accent_color
    } as any}>
      <header className="flex items-center gap-3 p-4 border-b">
        {dojang.logo_url && <img src={dojang.logo_url} className="h-10 w-10 rounded object-cover" />}
        <h1 className="font-black text-primary">{dojang.name}</h1>
      </header>
      {children}
    </div>
  )
}