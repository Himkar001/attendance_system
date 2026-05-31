import React, { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Download, Calendar, RefreshCw } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function Attendance({ API }) {
  const [tab,       setTab]       = useState('today')
  const [today,     setToday]     = useState(null)
  const [history,   setHistory]   = useState([])
  const [stats,     setStats]     = useState([])
  const [loading,   setLoading]   = useState(false)
  const [dateFilter, setDateFilter] = useState('')
  const [nameFilter, setNameFilter] = useState('')

  const fetchToday = () =>
    fetch(`${API}/api/attendance/today`)
      .then(r => r.json()).then(setToday).catch(() => {})

  const fetchHistory = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (dateFilter) params.set('date', dateFilter)
    if (nameFilter) params.set('name', nameFilter)
    fetch(`${API}/api/attendance/history?${params}`)
      .then(r => r.json()).then(setHistory).catch(() => {})
      .finally(() => setLoading(false))
  }

  const fetchStats = () =>
    fetch(`${API}/api/attendance/stats`)
      .then(r => r.json()).then(setStats).catch(() => {})

  useEffect(() => { fetchToday(); fetchStats() }, [])
  useEffect(() => { if (tab === 'history') fetchHistory() }, [tab, dateFilter, nameFilter])

  const exportCSV = () => {
    const url = dateFilter
      ? `${API}/api/attendance/export?date=${dateFilter}`
      : `${API}/api/attendance/export`
    window.open(url, '_blank')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Attendance</h1>
          <p className="text-gray-400 text-sm mt-1">Track and export attendance records</p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700
                     border border-gray-700 text-gray-300 hover:text-white rounded-xl text-sm transition-all"
        >
          <Download size={15} /> Export CSV
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
        {['today', 'history', 'stats'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium capitalize transition-all
              ${tab === t ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* TODAY */}
      {tab === 'today' && today && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total',    value: today.total_registered, color: 'text-blue-400' },
              { label: 'Present',  value: today.present_count,    color: 'text-green-400' },
              { label: 'Absent',   value: today.absent_count,     color: 'text-red-400' },
              { label: 'Rate',     value: `${today.percentage}%`, color: 'text-purple-400' },
            ].map(c => (
              <div key={c.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="text-gray-500 text-xs mb-2">{c.label}</div>
                <div className={`text-3xl font-bold ${c.color}`}>{c.value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Present */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <CheckCircle size={16} className="text-green-400" /> Present ({today.present_count})
              </h3>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {today.present.length === 0
                  ? <p className="text-gray-600 text-sm">No one marked yet.</p>
                  : today.present.map((p, i) => (
                    <div key={i} className="flex items-center justify-between bg-green-950/20
                                            border border-green-900/30 rounded-xl px-3 py-2">
                      <span className="text-white text-sm">{p.name}</span>
                      <span className="text-gray-500 text-xs">{p.time}</span>
                    </div>
                  ))
                }
              </div>
            </div>

            {/* Absent */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <XCircle size={16} className="text-red-400" /> Absent ({today.absent_count})
              </h3>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {today.absent.length === 0
                  ? <p className="text-gray-500 text-sm">Everyone is present! 🎉</p>
                  : today.absent.map((a, i) => (
                    <div key={i} className="flex items-center bg-red-950/20
                                            border border-red-900/30 rounded-xl px-3 py-2">
                      <span className="text-white text-sm">{a.name}</span>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY */}
      {tab === 'history' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="relative">
              <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="date"
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-4 py-2.5
                           text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <input
              type="text"
              placeholder="Filter by name..."
              value={nameFilter}
              onChange={e => setNameFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5
                         text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 w-52"
            />
            <button onClick={fetchHistory}
              className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-400 hover:text-white">
              <RefreshCw size={15} />
            </button>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {['Name', 'Date', 'Time', 'Status'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-gray-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? <tr><td colSpan={4} className="text-center py-10 text-gray-600">Loading...</td></tr>
                  : history.length === 0
                  ? <tr><td colSpan={4} className="text-center py-10 text-gray-600">No records found.</td></tr>
                  : history.map((r, i) => (
                    <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="px-5 py-3 text-white font-medium">{r.name}</td>
                      <td className="px-5 py-3 text-gray-400">{r.date}</td>
                      <td className="px-5 py-3 text-gray-400">{r.time}</td>
                      <td className="px-5 py-3">
                        <span className="bg-green-950/50 text-green-400 border border-green-800/50
                                         text-xs px-2.5 py-1 rounded-full">
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STATS */}
      {tab === 'stats' && (
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-5">Attendance Rate per Student</h3>
            {stats.length === 0
              ? <p className="text-gray-600 text-sm">No data yet.</p>
              : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={stats} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 12 }}
                           tickFormatter={v => `${v}%`} />
                    <Tooltip
                      contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                      formatter={v => [`${v}%`, 'Attendance']}
                    />
                    <Bar dataKey="percentage" radius={[6, 6, 0, 0]}>
                      {stats.map((_, i) => (
                        <Cell key={i} fill={_ .percentage >= 75 ? '#22c55e' : _.percentage >= 50 ? '#f59e0b' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )
            }
          </div>

          {/* Table */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {['Student', 'Days Present', 'Total Days', 'Rate'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-gray-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.map((s, i) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-5 py-3 text-white font-medium">{s.name}</td>
                    <td className="px-5 py-3 text-gray-400">{s.days_present}</td>
                    <td className="px-5 py-3 text-gray-400">{s.total_days}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-800 rounded-full h-1.5 w-24">
                          <div
                            className={`h-1.5 rounded-full ${s.percentage >= 75 ? 'bg-green-500' : s.percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${s.percentage}%` }}
                          />
                        </div>
                        <span className="text-white text-sm font-medium">{s.percentage}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
