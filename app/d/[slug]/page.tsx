'use client'
import { useParams } from 'next/navigation'
import { useRef, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function RecordPage() {
  const params = useParams()
  const slug = params.slug as string
  const supabase = createClient()

  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [recording, setRecording] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [score, setScore] = useState<any>(null)
  const [dojang, setDojang] = useState<any>(null)
  const [practiceId, setPracticeId] = useState<string | null>(null)
  const [isPinned, setIsPinned] = useState(false)

  useEffect(() => {
    supabase.from('dojangs').select('*').eq('slug', slug).single().then(({data}) => setDojang(data))
  }, [])

  useEffect(() => {
    startCamera(facingMode)
    return () => stream?.getTracks().forEach(t => t.stop())
  }, [facingMode])

  const startCamera = async (mode: 'environment' | 'user') => {
    stream?.getTracks().forEach(t => t.stop())
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode }, audio: true })
      setStream(s)
      if (videoRef.current) {
        videoRef.current.srcObject = s
        videoRef.current.style.transform = mode === 'user'? 'scaleX(-1)' : 'scaleX(1)'
      }
    } catch (e) {
      if (mode === 'environment') setFacingMode('user')
      else alert('Camera permission needed — must be HTTPS')
    }
  }

  const toggleCamera = () => setFacingMode(prev => prev === 'environment'? 'user' : 'environment')

  const startCountdown = () => {
    setCountdown(3)
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(interval); startRecording(); return 0 }
        return c - 1
      })
    }, 1000)
  }

  const startRecording = () => {
    if (!stream) return
    let options: any = { videoBitsPerSecond: 800000 }
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) options.mimeType = 'video/webm;codecs=vp9'
    else options.mimeType = 'video/webm'
    const recorder = new MediaRecorder(stream, options)
    mediaRecorderRef.current = recorder
    const chunks: Blob[] = []
    recorder.ondataavailable = e => chunks.push(e.data)
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: options.mimeType })
      setRecordedBlob(blob)
      setPreviewUrl(URL.createObjectURL(blob))
    }
    recorder.start()
    setRecording(true)
    setTimeout(() => stopRecording(), 40000)
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  const uploadAndScore = async () => {
    if (!recordedBlob) return
    setUploading(true)
    const path = `${slug}/${Date.now()}.webm`
    const { data, error } = await supabase.storage.from('practice-videos').upload(path, recordedBlob)
    if (error) { alert('Upload failed: ' + error.message); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('practice-videos').getPublicUrl(data.path)

    const expiresAt = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString()
    const { data: inserted } = await supabase.from('practices').insert({
      dojang_id: dojang?.id,
      slug,
      video_url: urlData.publicUrl,
      poomsae: 'Taegeuk 1 Jang',
      pinned: false,
      expires_at: expiresAt
    }).select().single()

    setPracticeId(inserted.id)

    // CALL REAL SCORING FUNCTION THAT USES YOUR MOVEMENTS TABLE
    const { data: scoreData, error: scoreError } = await supabase.functions.invoke('score-practice', {
      body: { practiceId: inserted.id, formSlug: 'taegeuk-1-jang' }
    })

    if (scoreError) {
      console.error(scoreError)
      alert('Scoring failed, but video saved')
    } else {
      setScore(scoreData)
    }
    setIsPinned(false)
    setUploading(false)
  }

  const togglePin = async () => {
    if (!practiceId) return
    const newPinned =!isPinned
    await supabase.from('practices').update({
      pinned: newPinned,
      expires_at: newPinned? null : new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString()
    }).eq('id', practiceId)
    setIsPinned(newPinned)
  }

  if (score) {
    return (
      <div className="min-h-screen bg-gray-50 p-5 max-w-xl mx-auto">
        <div className="bg-white rounded- p-6 text-center shadow">
          <div className="text-sm tracking-widest uppercase text-gray-400">Taegeuk 1 Jang — Gold Standard vs You</div>
          <div className="text-7xl font-black mt-2" style={{color: dojang?.primary_color}}>{score.total}</div>
          <div className="grid grid-cols-3 gap-3 mt-6 text-sm">
            <div className="bg-gray-50 rounded-xl p-3"><div className="font-bold">{score.power}%</div><div className="text-xs text-gray-500">Power</div></div>
            <div className="bg-gray-50 rounded-xl p-3"><div className="font-bold">{score.focus}%</div><div className="text-xs text-gray-500">Focus</div></div>
            <div className="bg-gray-50 rounded-xl p-3"><div className="font-bold">{score.rhythm}%</div><div className="text-xs text-gray-500">Rhythm</div></div>
          </div>

          {previewUrl && <video src={previewUrl} controls className="w-full rounded-xl mt-6" />}

          <div className="mt-6 text-left">
            <div className="font-bold mb-3">Movement Breakdown (from your coaching notes):</div>
            <div className="space-y-3">
              {score.perMovement?.map((f: any) => (
                <div key={f.movement} className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">
                  <div className="font-bold">Movement {f.movement}: {f.english}</div>
                  <div className="text-xs text-gray-500">{f.korean}</div>
                  <div className="mt-2">⚠️ {f.issue}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 p-4 rounded-xl border bg-gray-50 text-left">
            <div className="flex justify-between items-start gap-3">
              <div>
                <div className="font-bold text-sm">Video Storage</div>
                <div className="text-xs text-gray-600 mt-1">{isPinned? 'Saved forever' : 'Auto-deletes in 21 days'}</div>
              </div>
              <button onClick={togglePin} className={`px-4 py-2 rounded-full text-xs font-bold ${isPinned? 'bg-black text-white' : 'bg-white border'}`}>
                {isPinned? 'Saved ✓' : 'Save Forever'}
              </button>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Link href={`/d/${slug}`} className="flex-1 bg-black text-white p-4 rounded-xl font-bold text-center">Done</Link>
            <button onClick={() => { setScore(null); setRecordedBlob(null); setPreviewUrl(null); setPracticeId(null); startCamera(facingMode) }} className="flex-1 border p-4 rounded-xl font-bold">Record Again</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="p-4 flex justify-between items-center bg-white border-b">
        <Link href={`/d/${slug}`} className="text-gray-600 font-bold">← Back</Link>
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500">{facingMode === 'environment'? 'Back Camera' : 'Front Camera'}</div>
          <button onClick={toggleCamera} disabled={recording || countdown > 0} className="border px-3 py-2 rounded-full text-sm font-bold disabled:opacity-50">🔄 Flip</button>
        </div>
      </div>
      <div className="p-4 bg-white">
        {!recordedBlob? (
          <>
            {!recording && countdown === 0 && (
              <button onClick={startCountdown} className="w-full p-5 rounded-xl font-black text-lg text-white shadow" style={{backgroundColor: dojang?.primary_color || '#0F4C8C'}}>
                Start Recording Taegeuk 1
              </button>
            )}
            {recording && (
              <button onClick={stopRecording} className="w-full p-5 rounded-xl font-black text-lg bg-red-600 text-white">● Stop Recording</button>
            )}
            <p className="text-center text-xs text-gray-400 mt-2">Compared to your YouTube gold standard • 2 angles</p>
          </>
        ) : (
          <div className="flex gap-3">
            <button onClick={uploadAndScore} disabled={uploading} className="flex-1 p-5 rounded-xl font-black text-lg text-white" style={{backgroundColor: dojang?.primary_color || '#0F4C8C'}}>
              {uploading? 'Uploading & Scoring...' : 'Get My Score!'}
            </button>
            <button onClick={() => { setRecordedBlob(null); setPreviewUrl(null); startCamera(facingMode) }} className="px-6 border rounded-xl font-bold">Retake</button>
          </div>
        )}
      </div>
      <div className="flex-1 relative bg-gray-900 flex items-center justify-center overflow-hidden min-h-">
        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover max-h-" />
        {countdown > 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <div className="text-9xl font-black text-white">{countdown}</div>
          </div>
        )}
        {previewUrl &&!recording && countdown === 0 && (
          <video src={previewUrl} controls className="absolute inset-0 w-full h-full object-cover" />
        )}
        {recording && <div className="absolute top-4 left-4 bg-red-600 text-white text-xs px-3 py-1 rounded-full animate-pulse">● REC • Gold Standard Compare</div>}
      </div>
    </div>
  )
}