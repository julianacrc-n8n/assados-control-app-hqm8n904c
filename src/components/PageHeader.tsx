interface PageHeaderProps {
  title: string
  subtitle: string
}

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <div>
      <h1
        className="text-foreground"
        style={{ fontSize: '1.875rem', fontWeight: 700, letterSpacing: '-0.025em' }}
      >
        {title}
      </h1>
      <p className="text-muted-foreground" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
        {subtitle}
      </p>
    </div>
  )
}
