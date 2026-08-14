import { useEffect, useState } from 'react'
import { Store, Code, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { useStoreSettings } from '@/hooks/useStoreSettings'
import { hexToHSL, hslToString } from '@/lib/color'
import type { StoreSettingsInput } from '@/types'

/** Default primary color used to pre-fill the color picker when none is set. */
const DEFAULT_PRIMARY_HEX = '#9D6B37'

/** Returns a hex string for the color input, falling back to the theme default. */
function colorOrDefault(hex: string | null): string {
  if (hex && hexToHSL(hex)) return hex
  return DEFAULT_PRIMARY_HEX
}

export default function SettingsPage() {
  const { settings, loading, error, updateSettings, refetch } = useStoreSettings()

  // Local form state — seeded from settings once loaded.
  const [storeName, setStoreName] = useState('')
  const [storePhone, setStorePhone] = useState('')
  const [storeWhatsapp, setStoreWhatsapp] = useState('')
  const [storeInstagram, setStoreInstagram] = useState('')
  const [storeAddress, setStoreAddress] = useState('')
  const [storeThankYouMessage, setStoreThankYouMessage] = useState('')
  const [storePrimaryColor, setStorePrimaryColor] = useState(DEFAULT_PRIMARY_HEX)
  const [storeLogoUrl, setStoreLogoUrl] = useState('')

  const [devBrandName, setDevBrandName] = useState('')
  const [devBrandWhatsapp, setDevBrandWhatsapp] = useState('')
  const [devBrandLandingPageUrl, setDevBrandLandingPageUrl] = useState('')
  const [devBrandShowOnReceipt, setDevBrandShowOnReceipt] = useState(false)

  const [savingStore, setSavingStore] = useState(false)
  const [savingBrand, setSavingBrand] = useState(false)

  // Seed form fields whenever settings load / change from realtime.
  useEffect(() => {
    if (loading) return
    setStoreName(settings.storeName || '')
    setStorePhone(settings.storePhone ?? '')
    setStoreWhatsapp(settings.storeWhatsapp ?? '')
    setStoreInstagram(settings.storeInstagram ?? '')
    setStoreAddress(settings.storeAddress ?? '')
    setStoreThankYouMessage(settings.storeThankYouMessage ?? '')
    setStorePrimaryColor(colorOrDefault(settings.storePrimaryColor))
    setStoreLogoUrl(settings.storeLogoUrl ?? '')

    setDevBrandName(settings.devBrandName ?? '')
    setDevBrandWhatsapp(settings.devBrandWhatsapp ?? '')
    setDevBrandLandingPageUrl(settings.devBrandLandingPageUrl ?? '')
    setDevBrandShowOnReceipt(!!settings.devBrandShowOnReceipt)
  }, [settings, loading])

  const handleSaveStore = async () => {
    setSavingStore(true)
    try {
      const partial: StoreSettingsInput = {
        storeName: storeName.trim() || 'Minha Loja',
        storePhone: storePhone.trim() || null,
        storeWhatsapp: storeWhatsapp.trim() || null,
        storeInstagram: storeInstagram.trim() || null,
        storeAddress: storeAddress.trim() || null,
        storeThankYouMessage: storeThankYouMessage.trim() || null,
        storePrimaryColor: storePrimaryColor || null,
        storeLogoUrl: storeLogoUrl.trim() || null,
      }
      await updateSettings(partial)
      toast.success('Dados da loja salvos com sucesso.')
    } catch {
      toast.error('Erro ao salvar dados. Tente novamente.')
    } finally {
      setSavingStore(false)
    }
  }

  const handleSaveBrand = async () => {
    setSavingBrand(true)
    try {
      const partial: StoreSettingsInput = {
        devBrandName: devBrandName.trim() || null,
        devBrandWhatsapp: devBrandWhatsapp.trim() || null,
        devBrandLandingPageUrl: devBrandLandingPageUrl.trim() || null,
        devBrandShowOnReceipt,
      }
      await updateSettings(partial)
      toast.success('Marca salva com sucesso.')
    } catch {
      toast.error('Erro ao salvar dados. Tente novamente.')
    } finally {
      setSavingBrand(false)
    }
  }

  return (
    <section>
      <PageHeader
        title="Configurações"
        subtitle="Personalize o aplicativo com os dados da sua loja."
      />

      {error ? (
        <div
          className="mt-8 flex flex-col items-center justify-center text-center"
          style={{ padding: '3rem 1.5rem' }}
        >
          <AlertCircle className="h-12 w-12 text-destructive" style={{ marginBottom: '1rem' }} />
          <h2 className="text-foreground" style={{ fontSize: '1.125rem', fontWeight: 600 }}>
            Erro ao carregar configurações
          </h2>
          <p
            className="text-muted-foreground"
            style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}
          >
            Não foi possível carregar os dados da loja.
          </p>
          <Button variant="outline" className="mt-4 h-11 px-5" onClick={() => void refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          {/* ===================== Card 1 — Dados da Loja ===================== */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Store className="h-5 w-5 text-primary" />
                Dados da Loja
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <StoreFormSkeleton />
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Nome da Loja">
                    <Input
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="Ex: Padaria São José"
                      className="h-11"
                    />
                  </Field>

                  <Field label="Telefone">
                    <Input
                      value={storePhone}
                      onChange={(e) => setStorePhone(e.target.value)}
                      placeholder="Ex: (11) 99999-9999"
                      className="h-11"
                    />
                  </Field>

                  <Field label="WhatsApp" help="Número no formato internacional, apenas números">
                    <Input
                      value={storeWhatsapp}
                      onChange={(e) => setStoreWhatsapp(e.target.value)}
                      placeholder="Ex: 5511999999999 (com DDI e DDD)"
                      className="h-11"
                    />
                  </Field>

                  <Field label="Instagram">
                    <Input
                      value={storeInstagram}
                      onChange={(e) => setStoreInstagram(e.target.value)}
                      placeholder="Ex: padariasaojose (sem @)"
                      className="h-11"
                    />
                  </Field>

                  <Field label="Endereço">
                    <Input
                      value={storeAddress}
                      onChange={(e) => setStoreAddress(e.target.value)}
                      placeholder="Ex: Rua das Flores, 123 - Centro"
                      className="h-11"
                    />
                  </Field>

                  <Field label="Mensagem de Agradecimento">
                    <Input
                      value={storeThankYouMessage}
                      onChange={(e) => setStoreThankYouMessage(e.target.value)}
                      placeholder="Ex: Obrigado pela preferência!"
                      className="h-11"
                    />
                  </Field>

                  <Field
                    label="Cor Principal"
                    help="Cor principal do aplicativo (botões, sidebar, etc.)"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={colorOrDefault(storePrimaryColor)}
                        onChange={(e) => setStorePrimaryColor(e.target.value)}
                        aria-label="Selecionar cor principal"
                        className="h-11 w-14 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1"
                      />
                      <Input
                        value={storePrimaryColor}
                        onChange={(e) => setStorePrimaryColor(e.target.value)}
                        placeholder="#9D6B37"
                        className="h-11"
                      />
                    </div>
                  </Field>

                  <Field
                    label="URL do Logo"
                    help="URL de imagem do logo da loja. Se vazio, mostra a inicial do nome."
                  >
                    <Input
                      value={storeLogoUrl}
                      onChange={(e) => setStoreLogoUrl(e.target.value)}
                      placeholder="Ex: https://... ou cole uma imagem"
                      className="h-11"
                    />
                  </Field>
                </div>
              )}

              <div className="mt-6">
                <Button
                  type="button"
                  className="h-11 gap-2"
                  disabled={loading || savingStore}
                  onClick={() => void handleSaveStore()}
                >
                  {savingStore ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar Dados da Loja'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ===================== Card 2 — Sua Marca (Desenvolvedor) ===================== */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Code className="h-5 w-5 text-primary" />
                Sua Marca (Desenvolvedor)
              </CardTitle>
              <CardDescription>
                Configure sua marca para aparecer no cupom dos seus clientes. Desative para o plano
                White Label.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <StoreFormSkeleton />
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Marca (Desenvolvedor)">
                    <Input
                      value={devBrandName}
                      onChange={(e) => setDevBrandName(e.target.value)}
                      placeholder="Ex: Juliana Software"
                      className="h-11"
                    />
                  </Field>

                  <Field label="WhatsApp">
                    <Input
                      value={devBrandWhatsapp}
                      onChange={(e) => setDevBrandWhatsapp(e.target.value)}
                      placeholder="Ex: 5511999999999"
                      className="h-11"
                    />
                  </Field>

                  <Field
                    label="Página de Vendas (URL)"
                    help="O QR Code no cupom apontará para esta URL. Se vazio, aponta para o WhatsApp."
                  >
                    <Input
                      value={devBrandLandingPageUrl}
                      onChange={(e) => setDevBrandLandingPageUrl(e.target.value)}
                      placeholder="Ex: https://meusistema.com"
                      className="h-11"
                    />
                  </Field>

                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <div className="flex items-center gap-3 rounded-md border border-border p-3">
                      <Switch
                        checked={devBrandShowOnReceipt}
                        onCheckedChange={setDevBrandShowOnReceipt}
                        aria-label="Exibir minha marca no cupom impresso"
                      />
                      <div className="flex flex-col">
                        <Label className="text-sm font-medium text-foreground">
                          Exibir minha marca no cupom impresso
                        </Label>
                        <span className="text-xs text-muted-foreground">
                          Ative para o plano Padrão (mais barato). Desative para o plano White
                          Label.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6">
                <Button
                  type="button"
                  className="h-11 gap-2"
                  disabled={loading || savingBrand}
                  onClick={() => void handleSaveBrand()}
                >
                  {savingBrand ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar Marca'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  )
}

/** A labeled form field with optional help text. */
function Field({
  label,
  help,
  children,
}: {
  label: string
  help?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {children}
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  )
}

/** Skeleton placeholders shown while settings are being fetched. */
function StoreFormSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-11 w-full" />
        </div>
      ))}
    </div>
  )
}

// Keep the helper import used (hslToString referenced for theme preview parity).
void hslToString
