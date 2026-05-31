import React, { useState, useEffect } from 'react'
import { Trash2, User, RefreshCw, AlertTriangle } from 'lucide-react'

export default function Students({ API }) {
  const [students, setStudents] = useState([])
  const [loading,  setLoading]  = useState(false)
  const [confirm,  setConfirm]  = useState(null)   // name to confirm delete
  const [message,  setMessage]  = useState(null)

  const fetchStudents = () => {
    setLoading(true)
    fetch(`${API}/api/students`)
      .then(r => r.json())
      .then(setStudents)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchStudents() }, [])

  const deleteStudent = async (name) => {
    setConfirm(null)
    const res  = await fetch(`${API}/api/students/${encodeURIComponent(name)}`, { method: 'DELETE' })
    const data = await res.json()
    setMessage({ type: res.ok ? 'success' : 'error', text: data.message })
    fetchStudents()
    setTimeout(() => setMessage(null), 3000)
  }

  const avatarColor = (name) => {
    const colors = ['bg-blue-600','bg-purple-600','bg-green-600','bg-orange-600',
                    'bg-pink-600','bg-teal-600','bg-red-600','bg-indigo-600']
    const idx = name.charCodeAt(0) % colors.length
    return colors[idx]
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Students</h1>
          <p className="text-gray-400 text-sm mt-1">Manage registered students</p>
        </div>
        <button
          onClick={fetchStudents}
          className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700
                     border border-gray-700 text-gray-300 hover:text-white rounded-xl text-sm transition-all"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Message toast */}
      {message && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm
          ${message.type === 'success'
            ? 'bg-green-950/50 border border-green-800/50 text-green-300'
            : 'bg-red-950/50 border border-red-800/50 text-red-300'}`}
        >
          {message.text}
        </div>
      )}

      {/* Stats bar */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4">
        <span className="text-gray-400 text-sm">
          {students.length === 0
            ? 'No students registered yet.'
            : `${students.length} student${students.length !== 1 ? 's' : ''} registered · ${students.reduce((s, x) => s + x.photos, 0)} photos total`}
        </span>
      </div>

      {/* Student grid */}
      {loading ? (
        <div className="text-center py-16 text-gray-600">Loading...</div>
      ) : students.length === 0 ? (
        <div className="text-center py-16 text-gray-600 space-y-2">
          <User size={40} className="mx-auto opacity-30" />
          <p>No students registered yet.</p>
          <p className="text-sm">Go to <span className="text-blue-400">Register Student</span> to add someone.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {students.map((s, i) => (
            <div key={i}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-5
                         hover:border-gray-700 transition-all group"
            >
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className={`w-12 h-12 rounded-xl ${avatarColor(s.name)}
                                 flex items-center justify-center text-white font-bold text-lg shrink-0`}>
                  {s.name.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-white font-semibold truncate">{s.name}</div>
                  <div className="text-gray-500 text-xs mt-0.5">
                    {s.photos} photo{s.photos !== 1 ? 's' : ''} registered
                  </div>
                </div>

                {/* Delete button */}
                {confirm === s.name ? (
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => deleteStudent(s.name)}
                      className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white
                                 text-xs rounded-lg transition-all font-medium"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirm(null)}
                      className="px-2.5 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300
                                 text-xs rounded-lg transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirm(s.name)}
                    className="opacity-0 group-hover:opacity-100 p-2 rounded-lg
                               text-gray-500 hover:text-red-400 hover:bg-red-950/30 transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              {/* Photo count bar */}
              <div className="mt-4">
                <div className="flex justify-between text-xs text-gray-600 mb-1.5">
                  <span>Photos</span>
                  <span>{s.photos} / 5 recommended</span>
                </div>
                <div className="bg-gray-800 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${s.photos >= 5 ? 'bg-green-500' : s.photos >= 3 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(s.photos / 5 * 100, 100)}%` }}
                  />
                </div>
              </div>

              {s.photos < 3 && (
                <div className="mt-3 flex items-center gap-1.5 text-yellow-600 text-xs">
                  <AlertTriangle size={12} />
                  Add more photos for better accuracy
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
