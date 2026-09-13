'use client'
import { useParams, useRouter } from 'next/navigation'
import { useRef, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'

export default function RecordPage() {
  const params = useParams()
  const router = useRouter()
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
  const [status, setStatus] = useState('')

  useEffect(() => {
    supabase.from('dojangs').select('*').eq('slug', slug).single().then(({data}) => setDojang(data))
  }, [slug])

  useEffect(() => {
    startCamera(facingMode)
    return () => { stream?.getTracks().forEach(t => t.stop()) }
  }, [facingMode])

  const startCamera = async (mode: any) => {
    stream?.getTracks().forEach(t => t.stop())
    const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode }, audio: true })
    setStream(s)
    if (videoRef.current) {
      videoRef.current.srcObject = s
      videoRef.current.style.transform = mode === 'user'? 'scaleX(-1)' : 'scaleX(1)'
    }
  }

  const goBack = () => router.push(`/d/${slug}`)

  const startCountdown = () => {
    setCountdown(3)
    const iv = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(iv); startRecording(); return 0 }
        return c - 1
      })
    }, 1000)
  }

  const startRecording = () => {
    const rec = new MediaRecorder(stream!, { videoBitsPerSecond: 800000, mimeType: 'video/webm' })
    mediaRecorderRef.current = rec
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => chunks.push(e.data)
    rec.onstop = () => {
      const b = new Blob(chunks, { type: 'video/webm' })
      setRecordedBlob(b)
      setPreviewUrl(URL.createObjectURL(b))
    }
    rec.start()
    setRecording(true)
    setTimeout(() => { if (rec.state === 'recording') { rec.stop(); setRecording(false) } }, 40000)
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  // THIS IS THE FIX - full model + tracking options + 640x480
  const extractPoses = async (blob: Blob) => {
    setStatus('Loading MediaPipe full model... (better with dobok pants)')
    const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm')

    // HERE IS WHERE THE TRACKING OPTIONS GO
    const landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task'
      },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.7,
      minPosePresenceConfidence: 0.7,
      minTrackingConfidence: 0.7
    })

    setStatus('Analyzing movement... 0%')
    const video = document.createElement('video')
    video.src = URL.createObjectURL(blob)
    video.muted = true
    await new Promise((r) => { video.onloadedmetadata = r as any })
    await video.play()

    const poses: any[] = []
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 480
    const ctx = canvas.getContext('2d')!

    while (video.currentTime < video.duration) {
      ctx.drawImage(video, 0, 0, 640, 480)
      const result = landmarker.detectForVideo(canvas, performance.now())
      if (result.landmarks && result.landmarks[0]) {
        poses.push(result.landmarks[0])
      }
      video.currentTime += 0.1
      if (poses.length % 10 === 0) {
        setStatus(`Analyzing... ${Math.round((video.currentTime / video.duration) * 100)}% - ${poses.length} frames`)
      }
      await new Promise((r) => setTimeout(r, 10))
    }
    landmarker.close()
    setStatus('')
    return poses
  }

  const uploadAndScore = async () => {
    if (!recordedBlob) return
    setUploading(true)
    let poses: any[] = []
    try { poses = await extractPoses(recordedBlob) } catch (e) { console.error(e) }
    try {
      setStatus('Uploading video...')
      const path = `${slug}/${Date.now()}.webm`
      const { data: uploadData } = await supabase.storage.from('practice-videos').upload(path, recordedBlob)
      if (!uploadData) throw new Error('Video upload failed')
      const { data: urlData } = supabase.storage.from('practice-videos').getPublicUrl(uploadData.path)
      setStatus('Saving practice...')
      const expiresAt = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString()
      const { data: inserted, error: insertError } = await supabase.from('practices').insert({
        dojang_id: dojang?.id, slug, video_url: urlData.publicUrl, poomsae: 'Taegeuk 1 Jang', pinned: false, expires_at: expiresAt
      }).select().single()
      if (insertError) throw insertError
      if (poses.length > 0) {
        setStatus('Saving pose data...')
        const poseBlob = new Blob([JSON.stringify({ poses, frames: poses.length })], { type: 'application/json' })
        await supabase.storage.from('practice-poses').upload(`${inserted.id}-poses.json`, poseBlob, { upsert: true })
      }
      setStatus('Scoring vs gold...')
      const { data: scoreData } = await supabase.functions.invoke('score-practice', { body: { practiceId: inserted.id, formSlug: 'taegeuk-1-jang', poses } })
      setScore(scoreData)
      setUploading(false)
      setStatus('')
    } catch (err: any) {
      setStatus(`Error: ${err.message}`)
      setUploading(false)
    }
  }

  if (score) {
    return (
      <div className="min-h-screen bg-gray-50 p-5 max-w-xl mx-auto">
        <div className="bg-white rounded-3xl p-6 shadow">
          <div className="text-center">
            <div className="text-xs tracking-widest uppercase text-gray-400">Full Model vs Gold</div>
            <div className="text-7xl font-black mt-2" style={{ color: dojang?.primary_color }}>{score.total}</div>
          </div>
          {previewUrl && <video src={previewUrl} controls className="w-full rounded-xl mt-6" />}
          <div className="mt-6">
            <div className="font-bold">{score.perMovement && score.perMovement.length? `Faults: ${score.perMovement.length}` : 'No major faults!'}</div>
            <div className="space-y-3 mt-3">
              {score.perMovement && score.perMovement.map((f: any, i: number) => (
                <div key={i} className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm">
                  <div className="font-bold">Move {f.movement}: {f.english}</div>
                  <div className="mt-1">{f.issue}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-6">
            <button onClick={goBack} className="w-full bg-black text-white p-4 rounded-xl font-bold">Back to Home</button>
            <button onClick={() => { window.location.href = '/admin/debug' }} className="w-full bg-white border-2 border-black p-4 rounded-xl font-bold">Debugger</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="p-4 flex justify-between items-center border-b">
        <button onClick={goBack} className="font-bold text-gray-600">Back</button>
        <button onClick={() => setFacingMode((f) => f === 'environment'? 'user' : 'environment')} className="border px-3 py-2 rounded-full text-sm font-bold">Flip</button>
      </div>
      <div className="p-4">
        {!recordedBlob? (
        !recording && countdown === 0? (
            <button onClick={startCountdown} className="w-full p-5 rounded-xl font-black text-lg text-white" style={{ backgroundColor: dojang?.primary_color || '#0F4C8C' }}>Start Recording</button>
          ) : recording? (
            <button onClick={stopRecording} className="w-full p-5 rounded-xl font-black bg-red-600 text-white">Stop</button>
          ) : null
        ) : (
          <button onClick={uploadAndScore} disabled={uploading} className="w-full p-5 rounded-xl font-black text-lg text-white disabled:opacity-50" style={{ backgroundColor: dojang?.primary_color || '#0F4C8C' }}>{uploading? status : 'Get Score'}</button>
        )}
        {status && <div className="text-center text-xs text-gray-500 mt-2">{status}</div>}
      </div>
      <div className="flex-1 relative bg-gray-900 flex items-center justify-center overflow-hidden">
        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" style={{ maxHeight: '65vh' }} />
        {countdown > 0 && <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 text-9xl font-black text-white">{countdown}</div>}
        {previewUrl &&!recording && countdown === 0 && <video src={previewUrl} controls className="absolute inset-0 w-full h-full object-cover" />}
      </div>
    </div>
  )
}