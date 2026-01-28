import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../utils/api'
import { getGeolocation } from '../utils/geolocation'

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
        geolocation = await getGeolocation()
      } catch (err) {
        setGeoError('Location access required for registration. Please enable location services.')
        throw err
      }
      return authApi.register(username, email, password, geolocation.ltd, geolocation.lgt)
    },
    onSuccess: (data, variables, context) => {
      const geolocation = { ltd: context?.ltd, lgt: context?.lgt }
      register(data.user, data.token, geolocation)
      navigate('/profile')
    },
    onError: (err) => {
      setError(err.message || 'Registration failed. Please try again.')
    },
    context: async () => {
      try {
        return await getGeolocation()
      } catch (err) {
        return null
      }
    },
  })

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
      </div>
    </div>
  )
}
