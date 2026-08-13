import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface DeleteIngredientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDelete: () => Promise<void>
}

/**
 * Confirmation dialog for deleting an ingredient. Calls the supplied delete
 * function, shows PT-BR toasts for success/error, and closes on success.
 */
export function DeleteIngredientDialog({
  open,
  onOpenChange,
  onDelete,
}: DeleteIngredientDialogProps) {
  const [deleting, setDeleting] = useState(false)

  async function handleConfirm() {
    setDeleting(true)
    try {
      await onDelete()
      toast.success('Insumo excluído com sucesso.')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir insumo.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[400px] gap-0 rounded-[var(--radius)] p-6 shadow-xl">
        <AlertDialogHeader className="space-y-0">
          <AlertDialogTitle className="text-lg font-bold">Excluir insumo</AlertDialogTitle>
          <AlertDialogDescription className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Tem certeza que deseja excluir este insumo? Se ele estiver vinculado a uma receita, a
            receita será afetada.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6 flex-row gap-3 sm:space-x-0">
          <AlertDialogCancel disabled={deleting} className="h-11 sm:mt-0">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              void handleConfirm()
            }}
            disabled={deleting}
            className={cn(buttonVariants({ variant: 'destructive' }), 'h-11')}
          >
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Excluindo...
              </>
            ) : (
              'Excluir'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
