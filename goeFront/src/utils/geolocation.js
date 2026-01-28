export const getCurrentGeo = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
      },
      (error) => {
        if (error?.code === 1) {
          reject(new Error('Location access denied. Please enable location services.'))
          return
        }
        if (error?.code === 2) {
          reject(new Error('Location unavailable. Please try again.'))
          return
        }
        if (error?.code === 3) {
          reject(new Error('Location request timed out. Please try again.'))
          return
        }
        reject(new Error('Unable to retrieve your location'))
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  })
}
