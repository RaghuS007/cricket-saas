import { redirect } from 'next/navigation'
import { getServerToken } from '@/lib/auth-server'
import { apiGet } from '@/lib/api'
import { LogoutButton } from '@/components/logout-button'
import { Logo } from '@/components/logo'
import { NavLinks } from '@/components/nav-links'
import { UserChip } from '@/components/user-chip'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const token = await getServerToken()
  if (!token) redirect('/login')

  const user = await apiGet('/auth/me', token).catch(() => null)
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/80 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Logo />
          <NavLinks />
        </div>
        <div className="flex items-center gap-4">
          <UserChip email={user.email} />
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
