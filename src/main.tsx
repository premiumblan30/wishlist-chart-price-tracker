import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { useAuthStore } from './stores/authStore'
import './index.css'
import App from './App.tsx'

function Main() {
  const { darkMode } = useAuthStore()

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Main />
  </StrictMode>,
)
