import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { app, db } from './services/firebase.js'

// Make Firebase available globally for components that expect window.firebase
if (typeof window !== 'undefined') {
  window.firebase = {
    app,
    firestore: db,
    Timestamp: {
      fromDate: (date) => ({ toDate: () => date, seconds: Math.floor(date.getTime() / 1000) }),
      now: () => ({ toDate: () => new Date(), seconds: Math.floor(Date.now() / 1000) })
    }
  }
}

const container = document.getElementById('root')
const root = createRoot(container)

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)