import { ScanLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/PageHeader'

export default function PosPage() {
  return (
    <section>
      <PageHeader title="Ponto de Venda" subtitle="Venda produtos com leitor de código de barras" />
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6 border rounded-lg bg-card border-dashed">
        <ScanLine className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-1">PDV em construção</h2>
        <p className="text-sm text-muted-foreground max-w-sm mb-6">
          Aqui você vai lançar vendas usando o leitor de código de barras.
        </p>
        <Button disabled className="h-11 px-6">
          Iniciar Venda
        </Button>
      </div>
    </section>
  )
}
