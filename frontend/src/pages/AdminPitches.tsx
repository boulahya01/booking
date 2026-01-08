import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
	
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { Pitch } from '../types/database'
import '../styles/AdminPitches.css'

export function AdminPitches() {
  const { profile: userProfile, loading: authLoading } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [pitches, setPitches] = useState<Pitch[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    capacity: 0,
    open_time: '08:00',
    close_time: '22:00',
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && userProfile?.role !== 'admin') {
      navigate('/dashboard')
      return
    }
    if (!authLoading) {
      fetchPitches()
    }
  }, [authLoading, userProfile, navigate])

  const fetchPitches = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.from('pitches').select('*')
      if (error) throw error
      setPitches(data || [])
    } catch (err: any) {
      toast.error(`Failed to load pitches: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (pitch: Pitch) => {
    setEditingId(pitch.id)
    setFormData({
      name: pitch.name,
      location: pitch.location,
      capacity: pitch.capacity,
      open_time: pitch.open_time,
      close_time: pitch.close_time,
    })
  }

  const handleCancel = () => {
    setEditingId(null)
  }

  const formatTimeDisplay = (time: string) => {
    if (time === '24:00') {
      return '00:00 (next day)'
    }
    return time
  }

  const handleSave = async (pitchId: string) => {
    try {
      let closeTime = formData.close_time

      // Auto-convert overnight times: if open_time > close_time, it means overnight
      // Convert close_time to '24:00' to indicate midnight next day
      if (formData.open_time > formData.close_time) {
        closeTime = '24:00'
      }

      // Update pitch
      const { error } = await supabase
        .from('pitches')
        .update({
          name: formData.name,
          location: formData.location,
          capacity: formData.capacity,
          open_time: formData.open_time,
          close_time: closeTime,
        })
        .eq('id', pitchId)

      if (error) throw error

      toast.success('Pitch updated successfully')
      setEditingId(null)
      fetchPitches()
    } catch (err: any) {
      toast.error(`Failed to update pitch: ${err.message}`)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'capacity' ? parseInt(value) : value,
    }))
  }

  if (loading) {
    return <div className="admin-pitches-container">Loading pitches...</div>
  }

  if (authLoading) {
    return <div className="admin-pitches-container">Loading...</div>
  }

  if (userProfile?.role !== 'admin') {
    return <div className="admin-pitches-container">Access denied. Admin only.</div>
  }

  return (
    <div className="admin-pitches-container">
      <h1>Manage Pitches</h1>

      <table className="pitches-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Location</th>
            <th>Capacity</th>
            <th>Open Time</th>
            <th>Close Time</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {pitches.map(pitch => (
            <tr key={pitch.id} className={editingId === pitch.id ? 'editing' : ''}>
              {editingId === pitch.id ? (
                <>
                  <td>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Pitch name"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      placeholder="Location"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      name="capacity"
                      value={formData.capacity}
                      onChange={handleInputChange}
                      min="1"
                    />
                  </td>
                  <td>
                    <input
                      type="time"
                      name="open_time"
                      value={formData.open_time}
                      onChange={handleInputChange}
                    />
                  </td>
                  <td>
                    <input
                      type="time"
                      name="close_time"
                      value={formData.close_time}
                      onChange={handleInputChange}
                    />
                  </td>
                  <td>
                    <button
                      className="btn btn-save"
                      onClick={() => handleSave(pitch.id)}
                    >
                      Save
                    </button>
                    <button className="btn btn-cancel" onClick={handleCancel}>
                      Cancel
                    </button>
                  </td>
                </>
              ) : (
                <>
                  <td>{pitch.name}</td>
                  <td>{pitch.location}</td>
                  <td>{pitch.capacity}</td>
                  <td className="time-cell">{pitch.open_time}</td>
                  <td className="time-cell">{formatTimeDisplay(pitch.close_time)}</td>
                  <td>
                    <button
                      className="btn btn-edit"
                      onClick={() => handleEdit(pitch)}
                    >
                      Edit
                    </button>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {pitches.length === 0 && (
        <div className="empty-state">
          <p>No pitches found. Create one to get started.</p>
        </div>
      )}
    </div>
  )
}
