interface PageHeaderProps {
  title: string
  subtitle: string
}

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <div className="mb-6 space-y-1">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">{title}</h1>
      <p className="text-sm md:text-base text-muted-foreground">{subtitle}</p>
    </div>
  )
}
