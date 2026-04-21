import { useMemo, useState } from 'react'
import './App.css'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '')

const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function App() {
  const [formData, setFormData] = useState({
    lat: 28.61,
    lon: 77.21,
    system_size_kw: 4,
    tilt: 25,
    azimuth: 180,
    shading_factor: 0.95,
    soiling_loss: 2,
    inverter_loss: 3,
    wiring_loss: 2,
    misc_loss: 1,
  })

  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const monthlyData = useMemo(() => {
    if (!result?.monthly_energy_kwh) return []

    return monthOrder.map((month) => ({
      month,
      value: Number(result.monthly_energy_kwh[month] ?? 0),
    }))
  }, [result])

  const maxMonthly = useMemo(() => {
    if (!monthlyData.length) return 1
    return Math.max(...monthlyData.map((item) => item.value), 1)
  }, [monthlyData])

  const handleInputChange = (event) => {
    const { name, value } = event.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    const payload = {
      lat: Number(formData.lat),
      lon: Number(formData.lon),
      system_size_kw: Number(formData.system_size_kw),
      tilt: Number(formData.tilt),
      azimuth: Number(formData.azimuth),
      shading_factor: Number(formData.shading_factor),
      losses: [
        Number(formData.soiling_loss),
        Number(formData.inverter_loss),
        Number(formData.wiring_loss),
        Number(formData.misc_loss),
      ],
    }

    try {
      const response = await fetch(`${API_BASE_URL}/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
      }

      const data = await response.json()
      setResult(data)
    } catch (submitError) {
      setResult(null)
      setError(submitError.message || 'Unable to fetch prediction data')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-shell">
      <header className="hero">
        <p className="hero-badge">SolarWizer Analytics</p>
        <h1>PV Performance Intelligence Dashboard</h1>
        <p>
          Enter site and system details to generate annual yield, monthly breakdown, performance ratio,
          and a weather-adjusted 7-day forecast.
        </p>
      </header>

      <main className="dashboard-grid">
        <section className="panel form-panel">
          <h2>Simulation Input</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <label>
                Latitude
                <input name="lat" type="number" step="0.01" value={formData.lat} onChange={handleInputChange} required />
              </label>

              <label>
                Longitude
                <input name="lon" type="number" step="0.01" value={formData.lon} onChange={handleInputChange} required />
              </label>

              <label>
                System Size (kW)
                <input
                  name="system_size_kw"
                  type="number"
                  step="0.1"
                  value={formData.system_size_kw}
                  onChange={handleInputChange}
                  required
                />
              </label>

              <label>
                Tilt (deg)
                <input name="tilt" type="number" step="1" value={formData.tilt} onChange={handleInputChange} required />
              </label>

              <label>
                Azimuth (deg)
                <input name="azimuth" type="number" step="1" value={formData.azimuth} onChange={handleInputChange} required />
              </label>

              <label>
                Shading Factor
                <input
                  name="shading_factor"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={formData.shading_factor}
                  onChange={handleInputChange}
                  required
                />
              </label>

              <label>
                Soiling Loss (%)
                <input
                  name="soiling_loss"
                  type="number"
                  step="0.1"
                  value={formData.soiling_loss}
                  onChange={handleInputChange}
                  required
                />
              </label>

              <label>
                Inverter Loss (%)
                <input
                  name="inverter_loss"
                  type="number"
                  step="0.1"
                  value={formData.inverter_loss}
                  onChange={handleInputChange}
                  required
                />
              </label>

              <label>
                Wiring Loss (%)
                <input
                  name="wiring_loss"
                  type="number"
                  step="0.1"
                  value={formData.wiring_loss}
                  onChange={handleInputChange}
                  required
                />
              </label>

              <label>
                Misc Loss (%)
                <input
                  name="misc_loss"
                  type="number"
                  step="0.1"
                  value={formData.misc_loss}
                  onChange={handleInputChange}
                  required
                />
              </label>
            </div>

            <button type="submit" disabled={loading}>
              {loading ? 'Running Simulation...' : 'Generate Forecast'}
            </button>
          </form>

          <p className="loss-hint">Losses are sent as [soiling, inverter, wiring, misc]</p>
          {error ? <p className="error-text">{error}</p> : null}
        </section>

        <section className="panel results-panel">
          <h2>Model Output</h2>

          {!result && !loading ? (
            <div className="empty-state">
              <p>Submit inputs to view energy and forecast analytics.</p>
            </div>
          ) : null}

          {loading ? <p className="loading">Computing prediction...</p> : null}

          {result ? (
            <>
              <div className="kpi-grid">
                <article className="kpi-card">
                  <span>Annual Energy</span>
                  <strong>{result.annual_energy_kwh} kWh</strong>
                </article>

                <article className="kpi-card">
                  <span>Performance Ratio</span>
                  <strong>{result.performance_ratio}</strong>
                </article>

                <article className="kpi-card">
                  <span>Peak Monthly Yield</span>
                  <strong>{maxMonthly.toFixed(2)} kWh</strong>
                </article>
              </div>

              <div className="monthly-section">
                <h3>Monthly Energy (kWh)</h3>
                <div className="bar-chart">
                  {monthlyData.map((item) => (
                    <div key={item.month} className="bar-item">
                      <div className="bar-track">
                        <div className="bar-fill" style={{ height: `${(item.value / maxMonthly) * 100}%` }} />
                      </div>
                      <span className="bar-label">{item.month}</span>
                      <span className="bar-value">{item.value.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="forecast-section">
                <h3>7-Day Forecast</h3>
                <div className="forecast-grid">
                  {result.forecast_7_days?.map((day) => (
                    <article key={day.date} className="forecast-card">
                      <p className="forecast-date">{day.date}</p>
                      <p className="forecast-energy">{day.predicted_kwh} kWh</p>
                      <p>Cloud Cover: {day.cloud_cover}%</p>
                      <p>Max Temp: {day.temperature} C</p>
                    </article>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </section>
      </main>
    </div>
  )
}

export default App
