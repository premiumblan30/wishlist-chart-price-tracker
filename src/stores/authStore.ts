import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  user: { id: string; email: string } | null
  session: any | null
  loading: boolean
  darkMode: boolean
  setUser: (user: { id: string; email: string } | null) => void
  setSession: (session: any | null) => void
  setLoading: (loading: boolean) => void
  setDarkMode: (darkMode: boolean) => void
  toggleDarkMode: () => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      session: null,
      loading: true,
      darkMode: true, // Default to dark mode
      setUser: (user) => set({ user }),
      setSession: (session) => set({ session }),
      setLoading: (loading) => set({ loading }),
      setDarkMode: (darkMode) => set({ darkMode }),
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
      logout: () => set({ user: null, session: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ darkMode: state.darkMode }),
    }
  )
)
