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
      if (res.landmarks?.[0]) poses.push(res.landmarks[0])
      video.currentTime += 0.1
      if (poses.length % 20 === 0) setStatus(`Extracting ${name}... ${Math.round(video.currentTime / video.duration * 100)}% — ${poses.length} frames`)
      await new Promise(r => setTimeout(r, 10))
    }

    const jsonObj = { form: 'taegeuk-1-jang', angle: name, frames: poses.length, poses }
    const jsonStr = JSON.stringify(jsonObj)
    const blob = new Blob([jsonStr], { type: 'application/json' })

    // Try upload
    setStatus(`Uploading ${name}-poses.json...`)
    const { error } = await supabase.storage.from('reference-poses').upload(`${name}-poses.json`, blob, { upsert: true })

    if (error) {
      setStatus(`Upload failed: ${error.message} — Downloading file instead. Manually drag it into the bucket UI.`)
      const url = URL.createObjectURL(blob)
      setDownloadUrl(url)
      setDownloadName(`${name}-poses.json`)
    } else {
      setStatus(`✅ Uploaded ${name}-poses.json — ${poses.length} frames — Check Storage bucket now`)
    }
    landmarker.close()
  }

  return (
    <div className="p-10 max-w-xl mx-auto">
      <h1 className="text-2xl font-black">Generate Gold Standard Poses</h1>
      <p className="text-sm text-gray-500 mt-2">Upload front.mp4 and side.mp4. If upload fails due to policy, it will give you a download link to drag into Supabase.</p>
      <div className="mt-6 space-y-4">
        <div>
          <div className="font-bold text-sm">Front angle (L4T0ixGVupU)</div>
          <input type="file" accept="video/*" onChange={e => e.target.files?.[0] && processFile(e.target.files[0], 'taegeuk-1-jang-front')} className="mt-1" />
        </div>
        <div>
          <div className="font-bold text-sm">Side angle (ac9k87OqD7E)</div>
          <input type="file" accept="video/*" onChange={e => e.target.files?.[0] && processFile(e.target.files[0], 'taegeuk-1-jang-side')} className="mt-1" />
        </div>
      </div>
      <div className="mt-6 p-4 bg-gray-100 rounded-xl text-sm whitespace-pre-wrap">{status || 'Waiting...'}</div>
      {downloadUrl && (
        <a href={downloadUrl} download={downloadName} className="mt-4 inline-block bg-black text-white px-6 py-3 rounded-xl font-bold">
          ⬇️ Download {downloadName} and manually upload to bucket
        </a>
      )}
      <div className="mt-8 text-xs text-gray-400">
        After both files are in bucket, refresh this page you screenshotted — you should see 3 files: combined.json + front-poses.json + side-poses.json
      </div>
    </div>
  )
}