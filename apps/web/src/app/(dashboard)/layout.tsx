import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Belt-and-suspenders guard; middleware already handles the redirect.
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-background px-6 py-3 flex items-center justify-between">
        <span className="font-semibold tracking-tight">Cricket SaaS</span>
        <span className="text-sm text-muted-foreground">{user.email}</span>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
