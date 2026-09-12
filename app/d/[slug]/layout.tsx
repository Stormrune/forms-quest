import { createClient } from '@/lib/supabase/server'
import { ReactNode } from 'react'

export default async function DojangLayout({ 
  params, 
  children 
}: { 
  params: Promise<{ slug: string }>, 
  children: ReactNode 
}) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: dojang } = await supabase.from('dojangs').select('*').eq('slug', slug).single()

  if (!dojang) return <div className="p-8">Dojang not found: {slug}</div>

  return (
    <div style={{
      '--dojang-primary': dojang.primary_color,
      '--dojang-secondary': dojang.secondary_color,
      '--dojang-accent': dojang.accent_color
    } as any}>
      <header className="flex items-center gap-3 p-4 border-b bg-white">
        {dojang.logo_url && <img src={dojang.logo_url} className="h-10 w-10 rounded object-cover" alt="logo" />}
        <h1 className="font-black" style={{color: 'var(--dojang-primary)'}}>{dojang.name}</h1>
      </header>
      <main>{children}</main>
    </div>
  )
}