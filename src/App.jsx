import { useEffect, useMemo, useState } from 'react'

const backendBase = (() => {
  const env = import.meta?.env?.VITE_BACKEND_URL
  if (env) return env
  try {
    const url = new URL(window.location.href)
    // Dev: vite on 3000, backend on 8000
    if (url.port === '3000') {
      return `${url.protocol}//${url.hostname}:8000`
    }
    // Fallback to same origin
    return `${url.protocol}//${url.host}`
  } catch (e) {
    return ''
  }
})()

function Section({ title, children }) {
  return (
    <div className="bg-white/70 backdrop-blur rounded-xl p-5 shadow border border-slate-100">
      <h2 className="text-lg font-semibold text-slate-800 mb-3">{title}</h2>
      {children}
    </div>
  )
}

function App() {
  const [origin, setOrigin] = useState('Berlin, Germany')
  const [radius, setRadius] = useState(50)
  const [charger, setCharger] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [stations, setStations] = useState([])
  const [chatInput, setChatInput] = useState('What is typical charging price?')
  const [chatLog, setChatLog] = useState([])
  const [apiHealthy, setApiHealthy] = useState(false)

  const api = useMemo(() => ({
    async geocode(q) {
      const r = await fetch(`${backendBase}/api/geocode?q=` + encodeURIComponent(q))
      if (!r.ok) throw new Error('Geocoding failed')
      return r.json()
    },
    async stations(params = {}) {
      const p = new URLSearchParams(params)
      const r = await fetch(`${backendBase}/api/stations?` + p.toString())
      if (!r.ok) throw new Error('Stations failed')
      return r.json()
    },
    async optimize(body) {
      const r = await fetch(`${backendBase}/api/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error('Optimize failed')
      return r.json()
    },
    async chat(message) {
      const r = await fetch(`${backendBase}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      if (!r.ok) throw new Error('Chat failed')
      return r.json()
    },
    async ping() {
      const r = await fetch(`${backendBase}/`) 
      return r.ok
    }
  }), [])

  useEffect(() => {
    api.ping().then(setApiHealthy).catch(() => setApiHealthy(false))
    api.stations().then(setStations).catch(() => setStations([]))
  }, [])

  async function onOptimize() {
    setLoading(true)
    setResult(null)
    try {
      const data = await api.optimize({ origin, max_distance_km: Number(radius), preferred_charger: charger || null })
      setResult(data)
    } catch (e) {
      console.error(e)
      alert('Optimization failed. Try a different location.')
    } finally {
      setLoading(false)
    }
  }

  async function onSend() {
    if (!chatInput.trim()) return
    const userMsg = { role: 'user', content: chatInput }
    setChatLog((l) => [...l, userMsg])
    setChatInput('')
    try {
      const r = await api.chat(userMsg.content)
      const botMsg = { role: 'assistant', content: r.reply }
      setChatLog((l) => [...l, botMsg])
    } catch (e) {
      setChatLog((l) => [...l, { role: 'assistant', content: 'Sorry, something went wrong.' }])
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50">
      <header className="px-6 py-4 border-b border-slate-200 bg-white/70 backdrop-blur sticky top-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-indigo-600 text-white grid place-items-center font-bold">EV</div>
            <div>
              <h1 className="text-xl font-semibold text-slate-800">EV Charging Station Locator</h1>
              <p className="text-xs text-slate-500">Smart route optimization and chatbot assistance</p>
            </div>
          </div>
          <span className={`text-sm ${apiHealthy ? 'text-green-600' : 'text-red-600'}`}>{apiHealthy ? 'API Connected' : 'API Offline'}</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Section title="Find the best nearby charger">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input value={origin} onChange={e => setOrigin(e.target.value)} placeholder="Enter your location" className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <select value={charger} onChange={e => setCharger(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Any charger</option>
                <option value="CCS">CCS</option>
                <option value="CHAdeMO">CHAdeMO</option>
                <option value="Type2">Type2</option>
              </select>
              <input type="number" min={5} max={300} value={radius} onChange={e => setRadius(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button onClick={onOptimize} disabled={loading} className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 font-medium disabled:opacity-60">
                {loading ? 'Optimizing...' : 'Optimize route'}
              </button>
            </div>

            {result && (
              <div className="mt-5 grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border border-slate-200 bg-white">
                  <h3 className="font-semibold text-slate-800 mb-2">Recommended station</h3>
                  <div className="text-sm text-slate-700 space-y-1">
                    <p><span className="font-medium">Name:</span> {result.best_station.name}</p>
                    <p><span className="font-medium">Charger:</span> {result.best_station.charger_type} • {result.best_station.power_kw} kW</p>
                    <p><span className="font-medium">Distance:</span> {result.distance_km} km • ETA {result.eta_minutes} min</p>
                    <p><span className="font-medium">Coords:</span> {result.best_station.latitude.toFixed(4)}, {result.best_station.longitude.toFixed(4)}</p>
                    <a className="text-indigo-600 hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${result.best_station.latitude},${result.best_station.longitude}`}>Open in Google Maps</a>
                  </div>
                </div>
                <div className="p-4 rounded-lg border border-slate-200 bg-white">
                  <h3 className="font-semibold text-slate-800 mb-2">Top candidates</h3>
                  <ul className="text-sm text-slate-700 space-y-2 max-h-44 overflow-auto pr-2">
                    {result.candidates.map((c, i) => (
                      <li key={i} className="flex items-center justify-between border-b last:border-b-0 pb-2">
                        <div>
                          <p className="font-medium">{c.name}</p>
                          <p className="text-xs text-slate-500">{c.charger_type} • {c.power_kw} kW</p>
                        </div>
                        <span className="text-slate-900 font-semibold">{c.distance_km} km</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </Section>

          <Section title="Nearby stations (sample)">
            {stations.length === 0 ? (
              <p className="text-sm text-slate-600">No stations found yet.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {stations.map((s, i) => (
                  <div key={i} className="border border-slate-200 rounded-lg p-3 bg-white">
                    <p className="font-semibold text-slate-800">{s.name}</p>
                    <p className="text-xs text-slate-500">{s.charger_type} • {s.power_kw} kW</p>
                    <p className="text-xs text-slate-500">{s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}</p>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Assistant">
            <div className="h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 space-y-2">
              {chatLog.length === 0 && (
                <p className="text-sm text-slate-500">Ask about pricing, availability, or how to find the nearest station.</p>
              )}
              {chatLog.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                  <span className={`inline-block px-3 py-2 rounded-2xl ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-800'}`}>{m.content}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key==='Enter' && onSend()} placeholder="Type your question..." className="flex-1 rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button onClick={onSend} className="rounded-lg bg-slate-900 hover:bg-black text-white px-4 py-2 font-medium">Send</button>
            </div>
          </Section>

          <Section title="Preview">
            <img src="/preview.svg" alt="App preview" className="rounded-lg border border-slate-200 w-full" />
            <p className="text-xs text-slate-500 mt-2">This preview image is included for repository presentation.</p>
          </Section>
        </div>
      </main>

      <footer className="py-8 text-center text-xs text-slate-500">
        Built with FastAPI + React. Backend: {backendBase || 'same-origin'}
      </footer>
    </div>
  )
}

export default App
