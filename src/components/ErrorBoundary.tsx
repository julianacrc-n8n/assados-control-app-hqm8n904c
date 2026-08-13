import { Component, ReactNode, ErrorInfo } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  }

  public static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-background">
          <h2 className="text-lg font-semibold text-foreground mb-1">Algo deu errado.</h2>
          <p className="text-sm text-muted-foreground mb-4">Tente recarregar a página.</p>
          <Button onClick={() => window.location.reload()}>Recarregar</Button>
        </div>
      )
    }

    return this.props.children
  }
}
