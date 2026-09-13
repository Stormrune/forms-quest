'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'

export default function GoldPage() {
  const supabase = createClient()
  const [status, setStatus] = useState('')

  const processFile = async (file: File, name: string) => {
    setStatus(`Loading MediaPipe for ${name}...`)
    const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm')
    const landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task' },
      runningMode: 'VIDEO', numPoses: 1
    })

    const video = document.createElement('video')
    video.src = URL.createObjectURL(file)
    video.muted = true
    await new Promise(r => video.onloadedmetadata = r)
    await video.play()

    const poses: any[] = []
    const canvas = document.createElement('canvas')
    canvas.width = 320; canvas.height = 240
    const ctx = canvas.getContext('2d')!

    setStatus(`Extracting ${name}... 0%`)
    while (video.currentTime < video.duration) {
      ctx.drawImage(video, 0, 0, 320, 240)
      const res = landmarker.detectForVideo(canvas, performance.now())
      if (res.landmarks?.[0]) poses.push(res.landmarks[0]) // 33 landmarks
      video.currentTime += 0.1
      if (poses.length % 20 === 0) setStatus(`Extracting ${name}... ${Math.round(video.currentTime / video.duration * 100)}%`)
      await new Promise(r => setTimeout(r, 10))
    }

    const json = JSON.stringify({ form: 'taegeuk-1-jang', angle: name, frames: poses.length, poses })
    const blob = new Blob([json], { type: 'application/json' })
    await supabase.storage.from('reference-poses').upload(`${name}-poses.json`, blob, { upsert: true })
    setStatus(`Uploaded ${name}-poses.json — ${poses.length} frames`)
    landmarker.close()
  }

  return (
    <div className="p-10 max-w-xl mx-auto">
      <h1 className="text-2xl font-black">Generate Gold Standard Poses</h1>
      <p className="text-sm text-gray-500 mt-2">Upload front.mp4 and side.mp4. This runs MediaPipe in browser and creates real 33-point JSONs.</p>
      <div className="mt-6 space-y-4">
        <input type="file" accept="video/*" onChange={e => e.target.files?.[0] && processFile(e.target.files[0], 'taegeuk-1-jang-front')} />
        <input type="file" accept="video/*" onChange={e => e.target.files?.[0] && processFile(e.target.files[0], 'taegeuk-1-jang-side')} />
      </div>
      <div className="mt-6 p-4 bg-gray-100 rounded-xl text-sm">{status || 'Waiting for upload...'}</div>
    </div>
  )
}