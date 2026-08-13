import { TrendingUp, ShoppingBag, TrendingDown, Package } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/PageHeader'

const dashboardCards = [
  {
    title: 'Lucro Total',
    icon: TrendingUp,
  },
  {
    title: 'Vendas de Hoje',
    icon: ShoppingBag,
  },
  {
    title: 'Despesas do Mês',
    icon: TrendingDown,
  },
  {
    title: 'Produtos em Estoque',
    icon: Package,
  },
]

export default function DashboardPage() {
  return (
    <section>
      <PageHeader title="Dashboard" subtitle="Resumo financeiro do seu negócio" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {dashboardCards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title} className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-foreground">{card.title}</CardTitle>
                <Icon className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">Em breve</div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
