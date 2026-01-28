import { getCurrentGeo } from './geolocation'

const BASE_URL = 'http://localhost:3000'

const getAuthHeaders = async ({ includeGeo = true, geolocation } = {}) => {
  const token = localStorage.getItem('token')
  const storedUser = localStorage.getItem('user')
  const role = storedUser ? JSON.parse(storedUser)?.role : null
  const isGeoBypass = role === 'SUPER_ADMIN' || role === 'ADMIN'
  
  const headers = {
    'Content-Type': 'application/json',
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  if (includeGeo) {
    try {
      const resolvedGeolocation = geolocation ?? await getCurrentGeo()
      headers['x-geo-lat'] = resolvedGeolocation.lat
      headers['x-geo-lng'] = resolvedGeolocation.lng
    } catch (err) {
      if (!isGeoBypass) {
        throw err
      }
    }
  }
  
  return headers
}

export const api = {
  async post(endpoint, data, { includeGeo = true, geolocation } = {}) {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: await getAuthHeaders({ includeGeo, geolocation }),
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'An error occurred' }))
      throw new Error(errorData.error || 'Request failed')
    }

    return response.json()
  },

  async patch(endpoint, data, { includeGeo = true, geolocation } = {}) {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'PATCH',
      headers: await getAuthHeaders({ includeGeo, geolocation }),
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'An error occurred' }))
      throw new Error(errorData.error || 'Request failed')
    }

    return response.json()
  },

  async get(endpoint, { includeGeo = true, geolocation } = {}) {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      headers: await getAuthHeaders({ includeGeo, geolocation }),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'An error occurred' }))
      throw new Error(errorData.error || 'Request failed')
    }

    return response.json()
  },
  async put(endpoint, data, { includeGeo = true, geolocation } = {}) {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: await getAuthHeaders({ includeGeo, geolocation }),
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'An error occurred' }))
      throw new Error(errorData.error || 'Request failed')
    }

    return response.json()
  },
}

export const authApi = {
  login: (email, password, lat, lng) =>
    api.post('/auth/login', { email, password, lat, lng }, { includeGeo: false }),
  register: (username, email, password, lat, lng) =>
    api.post('/auth/register', { username, email, password, lat, lng }, { includeGeo: false }),
  updateGeolocation: (lat, lng, headerGeo) =>
    api.patch('/me/geolocation', { lat, lng }, { geolocation: headerGeo }),
}

export const adminApi = {
  getGeofence: () => api.get('/geofence'),
  setGeofence: (lat, lng, radiusMeters) =>
    api.put('/admin/geofence', { lat, lng, radiusMeters }),
}
