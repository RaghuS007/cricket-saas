import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerToken } from '@/lib/auth-server'
import { apiGet } from '@/lib/api'
import { LogoutButton } from '@/components/logout-button'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const token = await getServerToken()
  if (!token) redirect('/login')

  const user = await apiGet('/auth/me', token).catch(() => null)
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-background px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-semibold tracking-tight">Cricket SaaS</span>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/dashboard" className="hover:text-foreground">Dashboard</Link>
            <Link href="/auctions" className="hover:text-foreground">Auctions</Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{user.email}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
