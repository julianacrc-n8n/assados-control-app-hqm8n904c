import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Croissant, Loader2, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'

const MIN_PASSWORD_LENGTH = 8

export default function SignupPage() {
  const navigate = useNavigate()
  const { signUp } = useAuth()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH
  const passwordsDiffer = confirmPassword.length > 0 && confirmPassword !== password

  const canSubmit =
    name.trim() !== '' &&
    email.trim() !== '' &&
    password.length >= MIN_PASSWORD_LENGTH &&
    confirmPassword === password &&
    !loading

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError('A senha deve ter no mínimo 8 caracteres.')
      return
    }
    if (confirmPassword !== password) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)
    try {
      await signUp(name.trim(), email.trim(), password)
      toast.success('Conta criada com sucesso! Faça login para continuar.')
      navigate('/login', { replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown'
      if (msg === 'email-exists') {
        setError('Este e-mail já está cadastrado.')
      } else if (msg === 'network') {
        setError('Erro ao conectar. Tente novamente.')
      } else {
        setError('Erro ao conectar. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-[400px]">
        {/* Back / home link */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar
        </Link>

        <Card>
          <CardContent className="p-6">
            {/* Header */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mb-3">
                <Croissant className="h-6 w-6 text-primary" aria-hidden="true" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">Criar conta</h1>
              <p className="text-sm text-muted-foreground mt-1">Comece a gerenciar seus assados</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  disabled={loading}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  className="h-11"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={loading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                  className="h-11"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  disabled={loading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11"
                  aria-describedby="password-help"
                />
                {passwordTooShort && (
                  <p id="password-help" className="text-xs text-destructive">
                    A senha deve ter no mínimo 8 caracteres.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="confirmPassword">Confirmar senha</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  disabled={loading}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11"
                  aria-describedby="confirm-help"
                />
                {passwordsDiffer && (
                  <p id="confirm-help" className="text-xs text-destructive">
                    As senhas não coincidem.
                  </p>
                )}
              </div>

              {error && (
                <p role="alert" className="text-sm text-destructive text-center">
                  {error}
                </p>
              )}

              <Button type="submit" disabled={!canSubmit} className="h-11 w-full">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Criando conta...
                  </>
                ) : (
                  'Criar conta'
                )}
              </Button>
            </form>

            <p className="text-sm text-center text-muted-foreground mt-4">
              Já tem conta?{' '}
              <Link
                to="/login"
                className="font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
              >
                Entrar
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
