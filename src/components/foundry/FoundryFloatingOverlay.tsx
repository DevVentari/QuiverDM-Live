'use client'

import { useCallback, useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react'
import { Minus, Monitor, X } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { useFoundryOverlayStore } from '@/store/foundry-overlay-store'
import { useHeaderStore } from '@/store/header-store'

const MIN_WIDTH = 640
const MIN_HEIGHT = 400
const HEADER_HEIGHT = 40

function clampPosition(x: number, y: number, width: number) {
  if (typeof window === 'undefined') {
    return { x: Math.max(0, x), y: Math.max(0, y) }
  }

  const maxX = Math.max(0, window.innerWidth - width)
  const maxY = Math.max(0, window.innerHeight - HEADER_HEIGHT)

  return {
    x: Math.min(Math.max(0, x), maxX),
    y: Math.min(Math.max(0, y), maxY),
  }
}

export function FoundryFloatingOverlay() {
  const slot = useHeaderStore((s) => s.slot)
  const campaignId = slot?.campaignId ?? ''
  const {
    isOpen,
    isMinimized,
    position,
    size,
    close,
    minimize,
    unminimize,
    setPosition,
    setSize,
  } = useFoundryOverlayStore()

  const settings = trpc.foundry.getSettings.useQuery(
    { campaignId },
    { enabled: !!campaignId && isOpen },
  )
  const foundryUrl = settings.data?.foundryUrl
  const baseUrl = foundryUrl ? foundryUrl.replace(/\/game.*$/, '').replace(/\/$/, '') : null

  const dragging = useRef(false)
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 })

  const onHeaderMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if ((event.target as HTMLElement).closest('button')) return

      dragging.current = true
      dragStart.current = {
        mx: event.clientX,
        my: event.clientY,
        px: position.x,
        py: position.y,
      }
      event.preventDefault()
    },
    [position],
  )

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!dragging.current) return

      const dx = event.clientX - dragStart.current.mx
      const dy = event.clientY - dragStart.current.my
      setPosition(clampPosition(dragStart.current.px + dx, dragStart.current.py + dy, size.width))
    }

    const onUp = () => {
      dragging.current = false
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)

    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [setPosition, size.width])

  useEffect(() => {
    if (!isOpen) return

    const onResize = () => {
      setPosition(clampPosition(position.x, position.y, size.width))
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [isOpen, position.x, position.y, setPosition, size.width])

  const contentRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (isMinimized || !contentRef.current) return

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return

      const nextSize = {
        width: Math.max(MIN_WIDTH, Math.round(entry.contentRect.width)),
        height: Math.max(MIN_HEIGHT, Math.round(entry.contentRect.height)),
      }
      setSize(nextSize)
      setPosition(clampPosition(position.x, position.y, nextSize.width))
    })

    resizeObserver.observe(contentRef.current)
    return () => resizeObserver.disconnect()
  }, [isMinimized, position.x, position.y, setPosition, setSize])

  if (!isOpen || !baseUrl) return null

  return (
    <div
      style={{ left: position.x, top: position.y, width: size.width, zIndex: 9000 }}
      className="fixed flex flex-col overflow-hidden rounded-md border border-[var(--q-border-subtle)] bg-[var(--q-surface-raised)] shadow-2xl"
    >
      <div
        onMouseDown={onHeaderMouseDown}
        className="flex h-10 shrink-0 cursor-grab select-none items-center gap-2 border-b border-[var(--q-border-subtle)] border-l-2 border-l-[var(--q-amber)] bg-[var(--q-surface-elevated)] px-3 active:cursor-grabbing"
      >
        <Monitor className="h-3.5 w-3.5 shrink-0 text-[var(--q-amber)]" />
        <span className="flex-1 truncate text-xs font-semibold text-[var(--q-text)]">
          FoundryVTT{slot?.title ? ` - ${slot.title}` : ''}
        </span>
        <button
          type="button"
          onClick={isMinimized ? unminimize : minimize}
          className="rounded p-1 text-[var(--q-text-dim)] transition-colors hover:bg-[var(--q-amber-trace)] hover:text-[var(--q-text)]"
          aria-label={isMinimized ? 'Restore' : 'Minimise'}
        >
          <Minus className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={close}
          className="rounded p-1 text-[var(--q-text-dim)] transition-colors hover:bg-destructive/20 hover:text-destructive"
          aria-label="Close"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {!isMinimized && (
        <div
          ref={contentRef}
          style={{
            width: size.width,
            height: size.height,
            minWidth: MIN_WIDTH,
            minHeight: MIN_HEIGHT,
            resize: 'both',
            overflow: 'hidden',
          }}
          className="bg-black transition-[height] duration-150 ease-in-out"
        >
          <iframe
            src={`${baseUrl}/game?quiver=1`}
            className="block h-full w-full border-0"
            allow="storage-access; autoplay; fullscreen"
            title="FoundryVTT"
          />
        </div>
      )}
    </div>
  )
}
