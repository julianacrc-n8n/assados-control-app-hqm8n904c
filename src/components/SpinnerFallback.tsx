import { Loader2 } from 'lucide-react'

export function SpinnerFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <span className="text-sm text-muted-foreground font-medium">Carregando...</span>
    </div>
  )
}
