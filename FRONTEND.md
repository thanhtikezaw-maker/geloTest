# Frontend Geolocation Flow

## Overview
- Register and login require the user's current geolocation.
- Protected requests require geolocation headers on every call unless the user is a Super Admin or Admin.
- The allowed geofence is stored in the `AllowedArea` table and shared across users.
- User geolocation is stored in the `User` table for auditing.
- The first registered user is promoted to `SUPER_ADMIN` automatically.
- Super Admins manage the allowed area from the `/geofence` route in the React app.

## Geolocation Capture
```js
function getCurrentGeo() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}
```

## Register
```js
const geo = await getCurrentGeo();
await fetch("/api/auth/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    username,
    email,
    password,
    lat: geo.lat,
    lng: geo.lng,
  }),
});
```

## Login
```js
const geo = await getCurrentGeo();
const res = await fetch("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email,
    password,
    lat: geo.lat,
    lng: geo.lng,
  }),
});
```

## Protected Requests
```js
const geo = await getCurrentGeo();
await fetch("/api/me", {
  headers: {
    Authorization: `Bearer ${token}`,
    "x-geo-lat": geo.lat,
    "x-geo-lng": geo.lng,
  },
});
```

## Super Admin Geofence
```js
await fetch("/api/admin/geofence", {
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    lat: 40.7128,
    lng: -74.006,
    radiusMeters: 250,
  }),
});
```

## Update User Geolocation
```js
const geo = await getCurrentGeo();
await fetch("/api/me/geolocation", {
  method: "PATCH",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "x-geo-lat": geo.lat,
    "x-geo-lng": geo.lng,
  },
  body: JSON.stringify({ lat: geo.lat, lng: geo.lng }),
});
```
