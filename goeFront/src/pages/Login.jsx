import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../utils/api'
import { getCurrentGeo } from '../utils/geolocation'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [geoError, setGeoError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const mutation = useMutation({
    mutationFn: async () => {
      let geolocation
      try {
        geolocation = await getCurrentGeo()
      } catch (err) {
        setGeoError('Location access failed. Admin users can continue without location.')
      }
      return authApi.login(email, password, geolocation?.lat, geolocation?.lng)
    },
    onSuccess: (data, variables, context) => {
      login(data.user, data.token)
      setGeoError('')
      navigate('/profile')
    },
    onError: (err) => {
      const message = err.message || ''
      if (message.toLowerCase().includes('geo') || message.toLowerCase().includes('location')) {
        setGeoError(err.message)
        return
      }
      setError(err.message || 'Login failed. Please try again.')
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
        <h2>Login</h2>
        {error && <div className="error">{error}</div>}
        {geoError && <div className="error">{geoError}</div>}
        <form onSubmit={handleSubmit}>
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
            {mutation.isPending ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <p>
          Don't have an account? <Link to="/register">Register</Link>
        </p>
        <p className="location-note">
          Location access is required for standard users
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
