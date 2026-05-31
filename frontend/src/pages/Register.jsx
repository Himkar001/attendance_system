import React, { useState } from 'react'
import { UserPlus, CheckCircle, XCircle, RefreshCw, Camera } from 'lucide-react'

const TOTAL_CAPTURES = 5
const DELAY_MS = 800   // gap between each capture

export default function Register({ API }) {
  const [name,     setName]     = useState('')
  const [status,   setStatus]   = useState(null)   // {type, message}
  const [capturing, setCapturing] = useState(false)
  const [progress,  setProgress]  = useState(0)    // 0–TOTAL_CAPTURES
  const [previews,  setPreviews]  = useState([])   // blob URLs

  const sleep = ms => new Promise(r => setTimeout(r, ms))

  const captureAll = async () => {
    if (!name.trim()) {
      setStatus({ type: 'error', message: 'Please enter a student name first.' })
      return
    }

    setCapturing(true)
    setStatus(null)
    setPreviews([])
    setProgress(0)

    let successCount = 0
    const newPreviews = []

    for (let i = 0; i < TOTAL_CAPTURES; i++) {
      try {
        // Show preview of what's being captured
        const previewRes = await fetch(`${API}/api/register/preview`)
        const blob = await previewRes.blob()
        newPreviews[i] = URL.createObjectURL(blob)
        setPreviews([...newPreviews])

        // Register (captures fresh frame on backend)
        const res  = await fetch(`${API}/api/register`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ name: name.trim() }),
        })
        const data = await res.json()

        if (res.ok) {
          successCount++
          setProgress(i + 1)
        } else {
          setStatus({ type: 'error', message: `Capture ${i+1} failed: ${data.detail}` })
          break
        }
      } catch {
        setStatus({ type: 'error', message: 'Cannot reach backend. Is it running?' })
        break
      }

      // Small delay between captures so frames differ
      if (i < TOTAL_CAPTURES - 1) await sleep(DELAY_MS)
    }

    setCapturing(false)

    if (successCount === TOTAL_CAPTURES) {
      setStatus({ type: 'success', message: `✓ ${name.trim()} registered with ${TOTAL_CAPTURES} photos!` })
      setName('')
    } else if (successCount > 0) {
      setStatus({ type: 'error', message: `Only ${successCount}/${TOTAL_CAPTURES} captures succeeded. Try again.` })
    }
  }

  const reset = () => {
    setStatus(null)
    setPreviews([])
    setProgress(0)
    setName('')
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Register Student</h1>
        <p className="text-gray-400 text-sm mt-1">
          Enter name, position student in front of camera, and click Register.
          System will auto-capture {TOTAL_CAPTURES} photos.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Live feed */}
        <div className="rounded-2xl overflow-hidden border border-gray-800 bg-gray-900">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
            <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm text-gray-400 font-medium">Live Camera</span>
          </div>
          <img
            src={`${API}/video/feed`}
            alt="Live camera"
            className="w-full object-cover"
            style={{ height: '220px' }}
          />
        </div>

        {/* Progress + previews */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400 font-medium">Captures</span>
            <span className="text-sm text-gray-500">{progress}/{TOTAL_CAPTURES}</span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${(progress / TOTAL_CAPTURES) * 100}%` }}
            />
          </div>

          {/* Capture thumbnails grid */}
          <div className="grid grid-cols-5 gap-1.5 mt-1">
            {Array.from({ length: TOTAL_CAPTURES }).map((_, i) => (
              <div
                key={i}
                className={`aspect-square rounded-lg overflow-hidden border
                  ${i < progress
                    ? 'border-green-600'
                    : capturing && i === progress
                    ? 'border-blue-500 animate-pulse'
                    : 'border-gray-700'}`}
              >
                {previews[i] ? (
                  <img src={previews[i]} alt={`capture ${i+1}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                    {i < progress
                      ? <CheckCircle size={14} className="text-green-500" />
                      : <span className="text-gray-600 text-xs">{i+1}</span>
                    }
                  </div>
                )}
              </div>
            ))}
          </div>

          {capturing && (
            <p className="text-blue-400 text-xs text-center animate-pulse">
              Capturing {progress + 1} of {TOTAL_CAPTURES}... hold still
            </p>
          )}
        </div>
      </div>

      {/* Form */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Student Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !capturing && captureAll()}
            placeholder="e.g. Himkar Vashistha"
            disabled={capturing}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3
                       text-white placeholder-gray-500 focus:outline-none focus:border-blue-500
                       focus:ring-1 focus:ring-blue-500 transition disabled:opacity-50"
          />
        </div>

        {status && (
          <div className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm
            ${status.type === 'success'
              ? 'bg-green-950/50 border border-green-800/50 text-green-300'
              : 'bg-red-950/50 border border-red-800/50 text-red-300'}`}
          >
            {status.type === 'success'
              ? <CheckCircle size={16} className="shrink-0" />
              : <XCircle    size={16} className="shrink-0" />}
            {status.message}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={captureAll}
            disabled={capturing || !name.trim()}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700
                       disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold
                       py-3 rounded-xl transition-all"
          >
            {capturing
              ? <><RefreshCw size={16} className="animate-spin" /> Capturing {progress}/{TOTAL_CAPTURES}...</>
              : <><Camera size={16} /> Capture {TOTAL_CAPTURES} Photos & Register</>}
          </button>

          {(status || previews.length > 0) && !capturing && (
            <button
              onClick={reset}
              className="px-5 py-3 rounded-xl border border-gray-700 text-gray-400
                         hover:bg-gray-800 hover:text-white transition-all"
            >
              Reset
            </button>
          )}
        </div>

        <p className="text-gray-500 text-xs">
          💡 Slightly move your head between captures for better accuracy across angles.
        </p>
      </div>
    </div>
  )
}
