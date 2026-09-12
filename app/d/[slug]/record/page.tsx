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

  useEffect(() => {
    supabase.from('dojangs').select('*').eq('slug', slug).single().then(({data}) => setDojang(data))
  }, [])

  useEffect(() => {
    startCamera(facingMode)
    return () => stream?.getTracks().forEach(t => t.stop())
  }, [facingMode])

  const startCamera = async (mode: 'environment' | 'user') => {
    // Stop old stream
    stream?.getTracks().forEach(t => t.stop())
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode },
        audio: true
      })
      setStream(s)
      if (videoRef.current) {
        videoRef.current.srcObject = s
        // Mirror only front camera
        videoRef.current.style.transform = mode === 'user'? 'scaleX(-1)' : 'scaleX(1)'
      }
    } catch (e) {
      // Fallback to user if back camera not available
      if (mode === 'environment') {
        setFacingMode('user')
      } else {
        alert('Camera permission needed — must be HTTPS and allow camera')
      }
    }
  }

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'environment'? 'user' : 'environment')
  }

  const startCountdown = () => {
    setCountdown(3)
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(interval)
          startRecording()
          return 0
        }
        return c - 1
      })
    }, 1000)
  }

  const startRecording = () => {
    if (!stream) return
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' })
    mediaRecorderRef.current = recorder
    const chunks: Blob[] = []
    recorder.ondataavailable = e => chunks.push(e.data)
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' })
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

  const mockScore = () => {
    const power = Math.floor(62 + Math.random() * 25)
    const focus = Math.floor(70 + Math.random() * 20)
    const rhythm = Math.floor(65 + Math.random() * 20)
    const total = Math.floor((power + focus + rhythm) / 3)
    return {
      total, power, focus, rhythm,
      tip: power < 75? "Lengthen your Ap Kubi to unlock Power Kick!" : "Awesome power! Now work on rhythm pause."
    }
  }

  const uploadAndScore = async () => {
    if (!recordedBlob) return
    setUploading(true)
    const path = `${slug}/${Date.now()}.webm`
    const { data, error } = await supabase.storage.from('practice-videos').upload(path, recordedBlob)
    if (error) { alert('Upload failed: ' + error.message); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('practice-videos').getPublicUrl(data.path)
    const s = mockScore()
    setScore(s)
    await supabase.from('practices').insert({
      dojang_id: dojang?.id,
      slug,
      video_url: urlData.publicUrl,
      score: s.total,
      poomsae: 'Taegeuk 1 Jang',
      breakdown: s
    })
    setUploading(false)
  }

  if (score) {
    return (
      <div className="min-h-screen bg-gray-50 p-5 max-w-xl mx-auto">
        <div className="bg-white rounded-[24px] p-6 text-center shadow">
          <div className="text-sm tracking-widest uppercase text-gray-400">Taegeuk 1 Score</div>
          <div className="text-7xl font-black mt-2" style={{color: dojang?.primary_color}}>{score.total}</div>
          <div className="grid grid-cols-3 gap-3 mt-6 text-sm">
            <div className="bg-gray-50 rounded-xl p-3"><div className="font-bold">{score.power}%</div><div className="text-xs text-gray-500">Power</div></div>
            <div className="bg-gray-50 rounded-xl p-3"><div className="font-bold">{score.focus}%</div><div className="text-xs text-gray-500">Focus</div></div>
            <div className="bg-gray-50 rounded-xl p-3"><div className="font-bold">{score.rhythm}%</div><div className="text-xs text-gray-500">Rhythm</div></div>
          </div>
          <div className="mt-6 p-4 rounded-xl text-sm" style={{backgroundColor: `${dojang?.primary_color}15`, color: dojang?.primary_color}}>
            💡 {score.tip}
          </div>
          {previewUrl && <video src={previewUrl} controls className="w-full rounded-xl mt-6" />}
          <div className="mt-6 flex gap-3">
            <Link href={`/d/${slug}`} className="flex-1 bg-black text-white p-4 rounded-xl font-bold text-center">Done</Link>
            <button onClick={() => { setScore(null); setRecordedBlob(null); setPreviewUrl(null); startCamera(facingMode) }} className="flex-1 border p-4 rounded-xl font-bold">Record Again</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header with back + flip */}
      <div className="p-4 flex justify-between items-center bg-white border-b">
        <Link href={`/d/${slug}`} className="text-gray-600 font-bold">← Back</Link>
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500">{facingMode === 'environment'? 'Back Camera' : 'Front Camera'}</div>
          <button onClick={toggleCamera} disabled={recording || countdown > 0} className="border px-3 py-2 rounded-full text-sm font-bold disabled:opacity-50">
            🔄 Flip
          </button>
        </div>
      </div>

      {/* START BUTTON NOW ON TOP - always visible */}
      <div className="p-4 bg-white">
        {!recordedBlob? (
          <>
            {!recording && countdown === 0 && (
              <button onClick={startCountdown} className="w-full p-5 rounded-xl font-black text-lg text-white shadow" style={{backgroundColor: dojang?.primary_color || '#0F4C8C'}}>
                Start Recording Taegeuk 1
              </button>
            )}
            {recording && (
              <button onClick={stopRecording} className="w-full p-5 rounded-xl font-black text-lg bg-red-600 text-white">
                ● Stop Recording
              </button>
            )}
            <p className="text-center text-xs text-gray-400 mt-2">40 sec max • Place phone so full body is visible</p>
          </>
        ) : (
          <div className="flex gap-3">
            <button onClick={uploadAndScore} disabled={uploading} className="flex-1 p-5 rounded-xl font-black text-lg text-white" style={{backgroundColor: dojang?.primary_color || '#0F4C8C'}}>
              {uploading? 'Uploading...' : 'Get My Score!'}
            </button>
            <button onClick={() => { setRecordedBlob(null); setPreviewUrl(null); startCamera(facingMode) }} className="px-6 border rounded-xl font-bold">Retake</button>
          </div>
        )}
      </div>

      {/* Video below button */}
      <div className="flex-1 relative bg-gray-900 flex items-center justify-center overflow-hidden min-h-[50vh]">
        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover max-h-[65vh]" />
        {countdown > 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <div className="text-9xl font-black text-white">{countdown}</div>
          </div>
        )}
        {previewUrl &&!recording && countdown === 0 && (
          <video src={previewUrl} controls className="absolute inset-0 w-full h-full object-cover" />
        )}
        {recording && (
          <div className="absolute top-4 left-4 bg-red-600 text-white text-xs px-3 py-1 rounded-full animate-pulse">● REC</div>
        )}
      </div>
    </div>
  )
}