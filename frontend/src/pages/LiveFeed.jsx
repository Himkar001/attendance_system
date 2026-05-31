import React, { useState, useEffect } from 'react'
import { Play, Square, Users, CheckCircle, Clock } from 'lucide-react'

export default function LiveFeed({ API }) {
  const [recognizing, setRecognizing] = useState(false)
  const [todayData,   setTodayData]   = useState(null)
  const [loading,     setLoading]     = useState(false)

  const fetchToday = () =>
    fetch(`${API}/api/attendance/today`)
      .then(r => r.json())
      .then(setTodayData)
      .catch(() => {})

  useEffect(() => {
    fetchToday()
    const id = setInterval(fetchToday, 4000)
    return () => clearInterval(id)
  }, [])

  const toggleRecognition = async () => {
    setLoading(true)
    const endpoint = recognizing ? 'stop' : 'start'
    await fetch(`${API}/api/recognition/${endpoint}`, { method: 'POST' })
    setRecognizing(!recognizing)
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Live Feed</h1>
          <p className="text-gray-400 text-sm mt-1">Real-time face recognition attendance</p>
        </div>

        <button
          onClick={toggleRecognition}
          disabled={loading}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all
            ${recognizing
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-green-600 hover:bg-green-700 text-white'}
            disabled:opacity-50`}
        >
          {recognizing ? <><Square size={16} /> Stop Recognition</> : <><Play size={16} /> Start Recognition</>}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard
          icon={<Users size={20} className="text-blue-400" />}
          label="Total Students"
          value={todayData?.total_registered ?? '—'}
          bg="bg-blue-950/40 border-blue-800/40"
        />
        <StatCard
          icon={<CheckCircle size={20} className="text-green-400" />}
          label="Present Today"
          value={todayData?.present_count ?? '—'}
          bg="bg-green-950/40 border-green-800/40"
        />
        <StatCard
          icon={<Clock size={20} className="text-orange-400" />}
          label="Attendance %"
          value={todayData ? `${todayData.percentage}%` : '—'}
          bg="bg-orange-950/40 border-orange-800/40"
        />
      </div>

      {/* Video stream */}
      <div className="rounded-2xl overflow-hidden border border-gray-800 bg-gray-900">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
          <div className={`w-2.5 h-2.5 rounded-full ${recognizing ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
          <span className="text-sm text-gray-400 font-medium">
            {recognizing ? 'Recognition Active' : 'Camera Preview'}
          </span>
        </div>
        <img
          src={`${API}/video/feed`}
          alt="Live camera feed"
          className="w-full object-cover"
          style={{ maxHeight: '480px' }}
        />
      </div>

      {/* Present list */}
      {todayData?.present?.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-white font-semibold mb-3">Marked Today</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {todayData.present.map((p, i) => (
              <div key={i} className="flex items-center gap-2 bg-green-950/30 border border-green-800/30 rounded-xl px-3 py-2">
                <CheckCircle size={14} className="text-green-400 shrink-0" />
                <div>
                  <div className="text-white text-sm font-medium">{p.name}</div>
                  <div className="text-gray-500 text-xs">{p.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, bg }) {
  return (
    <div className={`rounded-2xl border p-5 ${bg}`}>
      <div className="flex items-center gap-2 mb-3">{icon}<span className="text-gray-400 text-sm">{label}</span></div>
      <div className="text-3xl font-bold text-white">{value}</div>
    </div>
  )
}
