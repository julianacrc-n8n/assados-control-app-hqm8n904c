import { Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/PageHeader'

export default function ProductsPage() {
  return (
    <section>
      <PageHeader title="Produtos" subtitle="Cadastro e gestão de produtos para venda" />
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6 border rounded-lg bg-card border-dashed">
        <Package className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-1">Nenhum produto cadastrado</h2>
        <p className="text-sm text-muted-foreground max-w-sm mb-6">
          Cadastre seus produtos para começar a vender.
        </p>
        <Button disabled className="h-11 px-6">
          Cadastrar Produto
        </Button>
      </div>
    </section>
  )
}
