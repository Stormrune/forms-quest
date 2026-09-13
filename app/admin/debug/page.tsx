'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const CONNECTIONS = [[11,12],[11,23],[12,24],[23,24],[11,13],[13,15],[12,14],[14,16],[23,25],[25,27],[27,29],[29,31],[24,26],[26,28],[28,30],[30,32]]

export default function DebugPage() {
  const supabase = createClient()
  const [practices, setPractices] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [goldPoses, setGoldPoses] = useState<any[]>([])
  const [studentPoses, setStudentPoses] = useState<any[]>([])
  const [frame, setFrame] = useState(0)
  const [threshold, setThreshold] = useState(0.35)
  const canvasStudent = useRef<HTMLCanvasElement>(null)
  const canvasGold = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    supabase.from('practices').select('*').order('created_at', { ascending: false }).limit(20).then(({data}) => setPractices(data||[]))
    const url = supabase.storage.from('reference-poses').getPublicUrl('taegeuk-1-jang-front-poses.json').data.publicUrl
    fetch(url).then(r => r.json()).then(j => setGoldPoses(j.poses || []))
  }, [])

  const loadPractice = async (p: any) => {
    setSelected(p)
    setFrame(0)
    const poseUrl = supabase.storage.from('practice-poses').getPublicUrl(`${p.id}-poses.json`).data.publicUrl
    const res = await fetch(poseUrl)
    if (res.ok) {
      const j = await res.json()
      setStudentPoses(j.poses || j || [])
    } else {
      setStudentPoses([])
      alert('No pose file found for this practice. Re-record after you created practice-poses bucket. Old recordings have no poses.')
    }
  }

  const drawSkeleton = (canvas: HTMLCanvasElement | null, pose: any[]) => {
    if (!canvas || !pose) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0,0,320,240)
    ctx.fillStyle = '#f9fafb'
    ctx.fillRect(0,0,320,240)
    CONNECTIONS.forEach(([a,b]) => {
      const pa = pose[a], pb = pose[b]
      if (!pa || !pb) return
      ctx.beginPath()
      ctx.moveTo(pa.x*320, pa.y*240)
      ctx.lineTo(pb.x*320, pb.y*240)
      ctx.strokeStyle = '#0F4C8C'
      ctx.lineWidth = 2
      ctx.stroke()
    })
    pose.forEach((p:any) => {
      if (!p) return
      ctx.beginPath()
      ctx.arc(p.x*320, p.y*240, 2.5, 0, Math.PI*2)
      ctx.fillStyle = '#ef4444'
      ctx.fill()
    })
  }

  useEffect(() => {
    drawSkeleton(canvasStudent.current, studentPoses[frame] || [])
    const goldIdx = goldPoses.length ? Math.floor(frame / (studentPoses.length || 1) * goldPoses.length) : 0
    drawSkeleton(canvasGold.current, goldPoses[goldIdx] || [])
  }, [frame, studentPoses, goldPoses])

  const perMoveDist = () => {
    if (!studentPoses.length || !goldPoses.length) return []
    const out = []
    for (let m=1; m<=21; m++) {
      const sMid = studentPoses[Math.floor((m-0.5)/21*studentPoses.length)]
      const gMid = goldPoses[Math.floor((m-0.5)/21*goldPoses.length)]
      if (!sMid || !gMid) continue
      let sum=0, n=0
      for (let i=11; i<33; i++) {
        if (sMid[i] && gMid[i]) {
          sum += Math.hypot(sMid[i].x - gMid[i].x, sMid[i].y - gMid[i].y)
          n++
        }
      }
      out.push({ m, dist: n? sum/n : 0 })
    }
    return out
  }

  const dists = perMoveDist()

  return (
    <div className="p-6 max-w-6xl mx-auto bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-black">Gold vs Student Debugger</h1>
      <p className="text-sm text-gray-500 mt-1">Pick a practice. Scrub frames. See why it flagged you. Adjust threshold before shipping.</p>

      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="bg-white rounded-xl p-4 shadow max-h-screen overflow-auto">
          <div className="font-bold mb-2">Recent practices</div>
          {practices.map(p => (
            <button key={p.id} onClick={() => loadPractice(p)} className={`block w-full text-left p-2 rounded text-sm mb-1 ${selected?.id===p.id? 'bg-black text-white' : 'bg-gray-100'}`}>
              {new Date(p.created_at).toLocaleString()} - Score {p.score} - {p.breakdown?.perMovement?.length||0} faults
            </button>
          ))}
        </div>

        <div className="col-span-2">
          {selected? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-3 shadow">
                  <div className="text-xs font-bold mb-2">STUDENT - Move {Math.floor(frame / (studentPoses.length||1) * 21)+1} - Frame {frame}/{studentPoses.length}</div>
                  <video src={selected.video_url} controls className="w-full rounded-xl bg-black" style={{maxHeight: '280px'}} />
                  <canvas ref={canvasStudent} width={320} height={240} className="w-full border mt-2 rounded-xl" />
                </div>
                <div className="bg-white rounded-xl p-3 shadow">
                  <div className="text-xs font-bold mb-2">GOLD - Master Skutt - {goldPoses.length} frames</div>
                  <div className="w-full rounded-xl bg-black flex items-center justify-center text-white text-xs" style={{height: '280px'}}>Gold reference skeleton below is from front-poses.json</div>
                  <canvas ref={canvasGold} width={320} height={240} className="w-full border mt-2 rounded-xl" />
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 shadow mt-4">
                <input type="range" min={0} max={studentPoses.length-1} value={frame} onChange={e => setFrame(parseInt(e.target.value))} className="w-full" />
                <div className="flex gap-6 mt-3 items-center text-sm">
                  <div>Frame: {frame}</div>
                  <div>Threshold: <input type="range" min={0.1} max={1} step={0.05} value={threshold} onChange={e => setThreshold(parseFloat(e.target.value))} /> {threshold}</div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 shadow mt-4">
                <div className="font-bold mb-2">Per-Movement Distance from Gold</div>
                {dists.map(d => {
                  const flagged = d.dist > threshold
                  const fault = selected.breakdown?.perMovement?.find((f:any)=>f.movement===d.m)
                  return (
                    <div key={d.m} className={`flex justify-between text-xs p-2 rounded mb-1 ${flagged? 'bg-red-100' : 'bg-green-50'}`}>
                      <span>Move {d.m} {fault? '- ' + fault.issue.substring(0,60) : ''}</span>
                      <span className="font-mono">{d.dist.toFixed(3)} {flagged? 'FLAGGED' : 'OK'}</span>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="bg-white rounded-xl p-10 shadow text-center text-gray-400">Select a practice on the left. You need a practice that has a pose file in practice-poses bucket. Re-record after creating that bucket.</div>
          )}
        </div>
      </div>
    </div>
  )
}