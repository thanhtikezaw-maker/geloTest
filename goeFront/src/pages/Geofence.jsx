import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { adminApi } from '../utils/api'
import { getCurrentGeo } from '../utils/geolocation'
import { useAuth } from '../context/AuthContext'

export default function Geofence() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [ltd, setLtd] = useState('')
  const [lgt, setLgt] = useState('')
  const [radiusMeters, setRadiusMeters] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  const { data, isLoading } = useQuery({
    queryKey: ['geofence'],
    queryFn: async () => {
      try {
        return await adminApi.getGeofence()
      } catch (err) {
        if (err.message?.toLowerCase().includes('not configured')) {
          return null
        }
        throw err
      }
    },
    enabled: isSuperAdmin,
  })

  useEffect(() => {
    if (data?.area) {
      setLtd(String(data.area.ltd ?? ''))
      setLgt(String(data.area.lgt ?? ''))
      setRadiusMeters(String(data.area.radiusMeters ?? ''))
    }
  }, [data])

  const mutation = useMutation({
    mutationFn: async () => {
      return adminApi.setGeofence(Number(ltd), Number(lgt), Number(radiusMeters))
    },
    onSuccess: (data) => {
      setSuccess('Geofence updated.')
      setError('')
      if (data?.area) {
        setLtd(String(data.area.ltd))
        setLgt(String(data.area.lgt))
        setRadiusMeters(String(data.area.radiusMeters))
      }
    },
    onError: (err) => {
      setError(err.message || 'Unable to update geofence.')
      setSuccess('')
    },
  })

  const handleSubmit = (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    mutation.mutate()
  }

  const handleUseCurrentLocation = async () => {
    setError('')
    try {
      const location = await getCurrentGeo()
      setLtd(String(location.lat))
      setLgt(String(location.lng))
    } catch (err) {
      setError(err.message || 'Unable to access location.')
    }
  }

  const handleBack = () => {
    navigate('/profile')
  }

  if (!isSuperAdmin) {
    return (
      <div className="auth-container">
        <div className="auth-form">
          <h2>Geofence Settings</h2>
          <div className="error">Super Admin access is required.</div>
          <button type="button" onClick={handleBack}>
            Back to Profile
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-container">
      <div className="auth-form">
        <h2>Geofence Settings</h2>
        {isLoading && <p>Loading current geofence...</p>}
        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}
        <form onSubmit={handleSubmit}>
          <div>
            <label>Latitude (ltd)</label>
            <input
              type="number"
              step="any"
              value={ltd}
              onChange={(event) => setLtd(event.target.value)}
              required
            />
          </div>
          <div>
            <label>Longitude (lgt)</label>
            <input
              type="number"
              step="any"
              value={lgt}
              onChange={(event) => setLgt(event.target.value)}
              required
            />
          </div>
          <div>
            <label>Radius (meters)</label>
            <input
              type="number"
              step="any"
              value={radiusMeters}
              onChange={(event) => setRadiusMeters(event.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving...' : 'Save Geofence'}
          </button>
        </form>
        <button type="button" onClick={handleUseCurrentLocation}>
          Use Current Location
        </button>
        <button type="button" onClick={handleBack}>
          Back to Profile
        </button>
      </div>
    </div>
  )
}
