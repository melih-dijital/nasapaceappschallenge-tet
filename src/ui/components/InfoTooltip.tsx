// FAZ 9 §3.1 — InfoTooltip (Erişilebilir bilgi ipucu).
import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface InfoTooltipProps {
  text: string
  label?: string
  className?: string
}

export function InfoTooltip({ text, label = 'More information', className }: InfoTooltipProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`${label}: ${text}`}
            className={cn(
              'inline-flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              className,
            )}
          >
            <Info aria-hidden="true" className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
