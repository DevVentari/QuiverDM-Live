'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ImportModal } from './import-modal'

interface SourceCardProps {
  source: string
  label: string
  description: string
  authMode: 'api' | 'file' | 'both'
}

export function SourceCard({ source, label, description }: SourceCardProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Card
        className="cursor-pointer hover:border-amber-500/50 transition-colors"
        onClick={() => setOpen(true)}
      >
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium">{label}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <p className="text-xs text-muted-foreground mb-3">{description}</p>
          <Button size="sm" className="w-full" variant="outline">
            Import
          </Button>
        </CardContent>
      </Card>
      <ImportModal source={source} label={label} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
