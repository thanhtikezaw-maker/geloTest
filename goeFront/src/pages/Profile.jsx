import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useQuery } from '@tanstack/react-query'

const fetchUserPosts = async () => {
  const response = await fetch('https://jsonplaceholder.typicode.com/posts?_limit=5')
  return response.json()
}

export default function Profile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  const { data: posts, isLoading } = useQuery({
    queryKey: ['userPosts'],
    queryFn: fetchUserPosts,
  })

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleUpdateGeolocation = () => {
    navigate('/geolocation')
  }

  const handleGeofence = () => {
    navigate('/geofence')
  }

  if (!user) {
    navigate('/login')
    return null
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h1>Profile</h1>
        <div>
          {isSuperAdmin && (
            <button onClick={handleGeofence}>Manage Geofence</button>
          )}
          <button onClick={handleUpdateGeolocation}>Update Location</button>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </div>
      <div className="profile-info">
        <div className="user-card">
          <h2>User Information</h2>
          <p><strong>Username:</strong> {user.username}</p>
          <p><strong>Email:</strong> {user.email}</p>
          <p><strong>User ID:</strong> {user.id}</p>
          <p><strong>Role:</strong> {user.role}</p>
        </div>
        <div className="user-posts">
          <h2>Recent Posts</h2>
          {isLoading ? (
            <p>Loading posts...</p>
          ) : (
            <ul>
              {posts?.map((post) => (
                <li key={post.id}>
                  <h3>{post.title}</h3>
                  <p>{post.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
