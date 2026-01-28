import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../utils/api'
import { getCurrentGeo } from '../utils/geolocation'

export default function Register() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [geoError, setGeoError] = useState('')
  const { register } = useAuth()
  const navigate = useNavigate()

  const mutation = useMutation({
    mutationFn: async () => {
      let geolocation
      try {
        geolocation = await getCurrentGeo()
      } catch (err) {
        setGeoError('Location access required for registration. Please enable location services.')
        throw err
      }
      return authApi.register(username, email, password, geolocation.lat, geolocation.lng)
    },
    onSuccess: (data, variables, context) => {
      register(data.user, data.token)
      navigate('/profile')
    },
    onError: (err) => {
      if (err.message?.toLowerCase().includes('location')) {
        setGeoError(err.message)
        return
      }
      setError(err.message || 'Registration failed. Please try again.')
    },
  })

  const handleRetryLocation = () => {
    setGeoError('')
    mutation.mutate()
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    setGeoError('')
    mutation.mutate()
  }

  return (
    <div className="auth-container">
      <div className="auth-form">
        <h2>Register</h2>
        {error && <div className="error">{error}</div>}
        {geoError && <div className="error">{geoError}</div>}
        <form onSubmit={handleSubmit}>
          <div>
            <label>Username:</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label>Email:</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label>Password:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Registering...' : 'Register'}
          </button>
        </form>
        <p>
          Already have an account? <Link to="/login">Login</Link>
        </p>
        <p className="location-note">
          Location access is required for registration
        </p>
        {geoError && (
          <button type="button" onClick={handleRetryLocation} disabled={mutation.isPending}>
            {mutation.isPending ? 'Retrying...' : 'Retry Location'}
          </button>
        )}
      </div>
    </div>
  )
}
