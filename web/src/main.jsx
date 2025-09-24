import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'   // <— imprescindible

createRoot(document.getElementById('root')).render(<App />)
