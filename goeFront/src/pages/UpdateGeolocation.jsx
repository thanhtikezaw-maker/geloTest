import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../utils/api'
import { getCurrentGeo } from '../utils/geolocation'

export default function UpdateGeolocation() {
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [coords, setCoords] = useState(null)
  const navigate = useNavigate()

  const mutation = useMutation({
    mutationFn: async () => {
      const geolocation = await getCurrentGeo()
      return authApi.updateGeolocation(geolocation.lat, geolocation.lng, geolocation)
    },
    onSuccess: (data) => {
      setSuccess('Geolocation updated for your next login.')
      setError('')
      if (data?.geolocation) {
        setCoords(data.geolocation)
      }
    },
    onError: (err) => {
      setError(err.message || 'Unable to update geolocation.')
      setSuccess('')
    },
  })

  const handleSubmit = (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    setCoords(null)
    mutation.mutate()
  }

  const handleBack = () => {
    navigate('/profile')
  }

  return (
    <div className="auth-container">
      <div className="auth-form">
        <h2>Update Geolocation</h2>
        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}
        <form onSubmit={handleSubmit}>
          <button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Updating...' : 'Use Current Device Location'}
          </button>
        </form>
        {coords && (
          <p className="location-note">
            Save location: {coords.lat}, {coords.lng}
          </p>
        )}
        <button type="button" onClick={handleBack}>
          Back to Profile
        </button>
        <p className="location-note">
          Updating this will revoke the previously saved location for your next login.
        </p>
      </div>
    </div>
  )
}
