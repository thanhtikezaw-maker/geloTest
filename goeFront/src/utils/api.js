const BASE_URL = 'http://localhost:3000'

const getAuthHeaders = () => {
  const token = localStorage.getItem('token')
  const geolocation = localStorage.getItem('geolocation')
  
  const headers = {
    'Content-Type': 'application/json',
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  if (geolocation) {
    const { ltd, lgt } = JSON.parse(geolocation)
    headers['x-geo-ltd'] = ltd
    headers['x-geo-lgt'] = lgt
  }
  
  return headers
}

export const api = {
  async post(endpoint, data) {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'An error occurred' }))
      throw new Error(errorData.error || 'Request failed')
    }

    return response.json()
  },

  async get(endpoint) {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      headers: getAuthHeaders(),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'An error occurred' }))
      throw new Error(errorData.error || 'Request failed')
    }

    return response.json()
  },
}

export const authApi = {
  login: (email, password, ltd, lgt) => api.post('/auth/login', { email, password, ltd, lgt }),
  register: (username, email, password, ltd, lgt) => api.post('/auth/register', { username, email, password, ltd, lgt }),
}