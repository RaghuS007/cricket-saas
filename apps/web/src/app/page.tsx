import { redirect } from 'next/navigation'

// Middleware handles auth redirect; this is a safety net for authenticated users at /.
export default function RootPage() {
  redirect('/dashboard')
}
