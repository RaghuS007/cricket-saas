'use client'

import { useRouter } from 'next/navigation'
import { clearAccessToken } from '@/lib/auth'

export function LogoutButton() {
  const router = useRouter()

  function handleLogout() {
    clearAccessToken()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      Sign out
    </button>
  )
}
