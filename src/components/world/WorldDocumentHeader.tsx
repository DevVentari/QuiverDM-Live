'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

interface WorldDocumentHeaderProps {
  imageUrl?: string | null
  title: string
  overline?: string
  className?: string
}

export function WorldDocumentHeader({ imageUrl, title, overline, className }: WorldDocumentHeaderProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-sm border border-[var(--q-border-subtle)]',
        className,
      )}
    >
      {imageUrl ? (
        <div className="relative h-64 w-full">
          <Image
            src={imageUrl}
            alt=""
            fill
            sizes="(min-width: 1280px) 60vw, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        </div>
      ) : (
        <div className="h-32 w-full bg-[linear-gradient(135deg,var(--q-amber-trace),transparent_70%)]" />
      )}
      <div className="absolute inset-x-0 bottom-0 p-6 space-y-1">
        {overline && (
          <p className="font-[var(--q-font-display)] text-[10px] tracking-[2.5px] text-[var(--q-amber)] uppercase">
            {overline}
          </p>
        )}
        <h2 className="font-[var(--q-font-display)] text-2xl text-[var(--q-text)]">{title}</h2>
      </div>
    </div>
  )
}
