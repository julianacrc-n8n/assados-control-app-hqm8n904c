import { BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/PageHeader'

export default function ReportsPage() {
  return (
    <section>
      <PageHeader title="Relatórios" subtitle="Balanço de lucros, despesas e vendas" />
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6 border rounded-lg bg-card border-dashed">
        <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-1">Sem relatórios ainda</h2>
        <p className="text-sm text-muted-foreground max-w-sm mb-6">
          Os relatórios aparecerão aqui quando houver dados.
        </p>
        <Button disabled className="h-11 px-6">
          Gerar Relatório
        </Button>
      </div>
    </section>
  )
}
