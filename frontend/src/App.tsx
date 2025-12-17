import { useState, useEffect } from 'react'
import './App.css'
import { supabase } from './lib/supabaseClient'

function App() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchBookings()
  }, [])

  const fetchBookings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/bookings')
      if (!response.ok) throw new Error('Failed to fetch bookings')
      const data = await response.json()
      setBookings(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <header>
        <h1>Booking Application</h1>
      </header>
      <main>
        <section className="bookings">
          <h2>Bookings</h2>
          {loading && <p>Loading...</p>}
          {error && <p className="error">{error}</p>}
          {bookings.length === 0 && !loading && <p>No bookings yet</p>}
          <ul>
            {bookings.map((booking: any) => (
              <li key={booking.id}>
                <strong>{booking.title}</strong> - {booking.date}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}

export default App
