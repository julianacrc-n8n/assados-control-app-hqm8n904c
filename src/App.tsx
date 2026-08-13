import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import Layout from '@/components/Layout'
import { SpinnerFallback } from '@/components/SpinnerFallback'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const DashboardPage = lazy(() => import('@/pages/Dashboard'))
const ProductsPage = lazy(() => import('@/pages/Products'))
const PurchasesPage = lazy(() => import('@/pages/Purchases'))
const PosPage = lazy(() => import('@/pages/Pos'))
const ReportsPage = lazy(() => import('@/pages/Reports'))

const App = () => (
  <ErrorBoundary>
    <BrowserRouter>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Suspense fallback={<SpinnerFallback />}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/purchases" element={<PurchasesPage />} />
              <Route path="/pos" element={<PosPage />} />
              <Route path="/reports" element={<ReportsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </TooltipProvider>
    </BrowserRouter>
  </ErrorBoundary>
)

export default App
