function initials(email: string) {
  const name = email.split('@')[0]
  return name.slice(0, 2).toUpperCase()
}

export function UserChip({ email }: { email: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
        {initials(email)}
      </span>
      <span className="hidden text-sm text-muted-foreground sm:inline">{email}</span>
    </div>
  )
}
