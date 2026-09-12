export const dynamic = 'force-dynamic'
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
    <div
      style={{
        '--dojang-primary': dojang.primary_color || '#0F4C8C',
        '--dojang-secondary': dojang.secondary_color || '#0A0A0A',
        '--dojang-accent': dojang.accent_color || '#E53935',
      } as any}
      className="min-h-screen bg-gray-50"
    >
      <header className="flex items-center justify-between p-4 bg-white border-b sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {dojang.logo_url? (
            <img src={dojang.logo_url} alt={dojang.name} className="h-10 w-10 rounded-full object-cover border" />
          ) : (
            <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-black" style={{backgroundColor: 'var(--dojang-primary)'}}>
              {dojang.name.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="font-black leading-none" style={{color: 'var(--dojang-primary)'}}>{dojang.name}</h1>
            <p className="text- text-gray-500 tracking-widest uppercase">Taegeuk Quest</p>
          </div>
        </div>
        <div className="h-2 w-2 rounded-full animate-pulse" style={{backgroundColor: 'var(--dojang-accent)'}}></div>
      </header>
      {children}
    </div>
  )
}