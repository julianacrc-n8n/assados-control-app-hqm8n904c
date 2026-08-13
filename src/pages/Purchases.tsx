import { ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/PageHeader'

export default function PurchasesPage() {
  return (
    <section>
      <PageHeader title="Compras" subtitle="Registro de compras de insumos e matéria-prima" />
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6 border rounded-lg bg-card border-dashed">
        <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-1">Nenhuma compra registrada</h2>
        <p className="text-sm text-muted-foreground max-w-sm mb-6">
          Registre suas compras para calcular o custo dos produtos.
        </p>
        <Button disabled className="h-11 px-6">
          Registrar Compra
        </Button>
      </div>
    </section>
  )
}
