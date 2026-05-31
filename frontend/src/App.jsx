import React, { useState, useEffect } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import { Camera, Users, ClipboardList, BarChart2, Wifi, WifiOff } from 'lucide-react'

import LiveFeed    from './pages/LiveFeed'
import Register    from './pages/Register'
import Attendance  from './pages/Attendance'
import Students    from './pages/Students'

const API = 'http://localhost:8000'

export default function App() {
  const [status, setStatus] = useState(null)

  useEffect(() => {
    const fetch_status = () =>
      fetch(`${API}/api/status`)
        .then(r => r.json())
        .then(setStatus)
        .catch(() => setStatus(null))

    fetch_status()
    const id = setInterval(fetch_status, 5000)
    return () => clearInterval(id)
  }, [])

  const navItem = (to, Icon, label) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium
         ${isActive
           ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
           : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`
      }
    >
      <Icon size={18} />
      {label}
    </NavLink>
  )

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 bg-gray-900 border-r border-gray-800 flex flex-col p-4 gap-2 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 px-2 py-4 mb-2">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
            <Camera size={20} className="text-white" />
          </div>
          <div>
            <div className="font-bold text-white text-sm">AttendAI</div>
            <div className="text-gray-500 text-xs">Face Recognition</div>
          </div>
        </div>

        {navItem('/live',       Camera,        'Live Feed')}
        {navItem('/register',   Users,         'Register Student')}
        {navItem('/attendance', ClipboardList, 'Attendance')}
        {navItem('/students',   BarChart2,     'Students')}

        {/* Status footer */}
        <div className="mt-auto p-3 bg-gray-800 rounded-xl text-xs space-y-1">
          <div className="flex items-center gap-2">
            {status?.camera
              ? <Wifi size={13} className="text-green-400" />
              : <WifiOff size={13} className="text-red-400" />}
            <span className="text-gray-400">Camera {status?.camera ? 'ON' : 'OFF'}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${status?.recognition ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
            <span className="text-gray-400">Recognition {status?.recognition ? 'Active' : 'Idle'}</span>
          </div>
          <div className="text-gray-500 pt-1">
            {status?.marked_today ?? 0} marked today &nbsp;·&nbsp; {status?.students ?? 0} students
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-gray-950 p-6">
        <Routes>
          <Route path="/"           element={<LiveFeed   API={API} />} />
          <Route path="/live"       element={<LiveFeed   API={API} />} />
          <Route path="/register"   element={<Register   API={API} />} />
          <Route path="/attendance" element={<Attendance API={API} />} />
          <Route path="/students"   element={<Students   API={API} />} />
        </Routes>
      </main>
    </div>
  )
}
