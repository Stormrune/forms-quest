'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'

export default function GoldPage() {
  const supabase = createClient()
  const [status, setStatus] = useState('')
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [downloadName, setDownloadName] = useState('')

  const processFile = async (file: File, name: string) => {
    setDownloadUrl(null)
    setStatus(`Loading MediaPipe FULL model for ${name}...`)

    const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm')
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

    const video = document.createElement('video')
    video.src = URL.createObjectURL(file)
    video.muted = true
    video.crossOrigin = 'anonymous'
    await new Promise((resolve: any) => { video.onloadedmetadata = resolve })
    video.pause()

    const poses: any[] = []
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 480
    const ctx = canvas.getContext('2d')!

    setStatus(`Extracting ${name}... 0%`)

    for (let t = 0; t < video.duration; t += 0.1) {
      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked)
          resolve()
        }
        video.addEventListener('seeked', onSeeked)
        video.currentTime = t
      })
      ctx.drawImage(video, 0, 0, 640, 480)
      const res = landmarker.detectForVideo(canvas, t * 1000)
      if (res.landmarks && res.landmarks[0]) {
        poses.push(res.landmarks[0])
      }
      if (poses.length % 20 === 0) {
        setStatus(`Extracting ${name}... ${Math.round((t / video.duration) * 100)}% - ${poses.length} frames`)
      }
    }

    const jsonObj = { form: 'taegeuk-1-jang', angle: name, frames: poses.length, poses }
    const blob = new Blob([JSON.stringify(jsonObj)], { type: 'application/json' })

    setStatus(`Uploading ${name}-poses.json...`)
    const { error } = await supabase.storage.from('reference-poses').upload(`${name}-poses.json`, blob, { upsert: true })

    if (error) {
      setStatus(`Upload failed: ${error.message} - Use download button`)
      const url = URL.createObjectURL(blob)
      setDownloadUrl(url)
      setDownloadName(`${name}-poses.json`)
    } else {
      setStatus(`Done! ${name}-poses.json - ${poses.length} frames - check bucket`)
    }

    landmarker.close()
  }

  return (
    <div className="p-10 max-w-xl mx-auto">
      <h1 className="text-2xl font-black">Generate Gold Poses - FULL Model Fixed Seek</h1>
      <p className="text-sm text-gray-500 mt-2">This version fixes frozen frames 65-80 bug. It waits for video seek.</p>
      <div className="mt-6 space-y-4">
        <div>
          <div className="font-bold text-sm">Front angle</div>
          <input type="file" accept="video/*" onChange={(e) => e.target.files && e.target.files[0] && processFile(e.target.files[0], 'taegeuk-1-jang-front')} className="mt-1" />
        </div>
        <div>
          <div className="font-bold text-sm">Side angle</div>
          <input type="file" accept="video/*" onChange={(e) => e.target.files && e.target.files[0] && processFile(e.target.files[0], 'taegeuk-1-jang-side')} className="mt-1" />
        </div>
      </div>
      <div className="mt-6 p-4 bg-gray-100 rounded-xl text-sm whitespace-pre-wrap">{status || 'Waiting...'}</div>
      {downloadUrl && (
        <a href={downloadUrl} download={downloadName} className="mt-4 inline-block bg-black text-white px-6 py-3 rounded-xl font-bold">
          Download {downloadName}
        </a>
      )}
    </div>
  )
}