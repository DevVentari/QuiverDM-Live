'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { trpc } from '@/lib/trpc'
import { ProgressView } from './progress-view'
import type { ImportSource } from '@/lib/import-adapters/types'

type FileSource = 'obsidian' | 'docx' | 'markdown_file' | 'campfire'

const FILE_SOURCES: FileSource[] = ['obsidian', 'docx', 'markdown_file', 'campfire']

export function ImportModal({
  source,
  label,
  open,
  onClose,
}: {
  source: string
  label: string
  open: boolean
  onClose: () => void
}) {
  const [jobId, setJobId] = useState<string | null>(null)
  const [params, setParams] = useState<Record<string, unknown>>({})
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startImport = trpc.importHub.startImport.useMutation()
  const isFileSource = FILE_SOURCES.includes(source as FileSource)

  async function handleSubmit() {
    setError(null)
    setUploading(true)
    try {
      let finalParams = { ...params }

      if (isFileSource && file) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('source', source)
        const res = await fetch('/api/imports/upload', { method: 'POST', body: formData })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Upload failed')
        finalParams = { ...finalParams, fileKey: data.fileKey, originalName: file.name }
      }

      const result = await startImport.mutateAsync({
        source: source as ImportSource,
        params: finalParams,
      })
      setJobId(result.jobId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setUploading(false)
    }
  }

  function handleClose() {
    setJobId(null)
    setParams({})
    setFile(null)
    setError(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import from {label}</DialogTitle>
        </DialogHeader>

        {jobId ? (
          <ProgressView jobId={jobId} onComplete={handleClose} />
        ) : (
          <div className="space-y-4">
            {source === 'notion' && (
              <div className="space-y-2">
                <Label>Page IDs (comma-separated)</Label>
                <Input
                  placeholder="3a11b929-6012-..., ea5d3c58-..."
                  onChange={(e) =>
                    setParams((p) => ({
                      ...p,
                      pageIds: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    }))
                  }
                />
                <Label>Notion Token</Label>
                <Input
                  type="password"
                  placeholder="secret_..."
                  onChange={(e) => setParams((p) => ({ ...p, token: e.target.value }))}
                />
              </div>
            )}

            {source === 'google_docs' && (
              <div className="space-y-2">
                <Label>Google Doc URL</Label>
                <Input
                  placeholder="https://docs.google.com/document/d/..."
                  onChange={(e) => setParams((p) => ({ ...p, docUrl: e.target.value }))}
                />
              </div>
            )}

            {source === 'world_anvil' && (
              <div className="space-y-2">
                <Label>API Token</Label>
                <Input type="password" onChange={(e) => setParams((p) => ({ ...p, token: e.target.value, mode: 'api' }))} />
                <Label>World Slug</Label>
                <Input onChange={(e) => setParams((p) => ({ ...p, worldSlug: e.target.value }))} />
              </div>
            )}

            {source === 'kanka' && (
              <div className="space-y-2">
                <Label>API Token</Label>
                <Input type="password" onChange={(e) => setParams((p) => ({ ...p, token: e.target.value, mode: 'api' }))} />
                <Label>Campaign ID</Label>
                <Input onChange={(e) => setParams((p) => ({ ...p, campaignId: e.target.value }))} />
              </div>
            )}

            {isFileSource && (
              <div className="space-y-2">
                <Label>
                  Upload File{' '}
                  <span className="text-muted-foreground text-xs">
                    ({source === 'obsidian' ? '.zip' : source === 'docx' ? '.docx' : source === 'campfire' ? '.json' : '.md'})
                  </span>
                </Label>
                <Input
                  type="file"
                  accept={
                    source === 'obsidian' ? '.zip' :
                    source === 'docx' ? '.docx,.doc' :
                    source === 'campfire' ? '.json' :
                    '.md,.txt'
                  }
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button
              onClick={handleSubmit}
              disabled={uploading || startImport.isPending}
              className="w-full"
            >
              {uploading || startImport.isPending ? 'Starting…' : 'Start Import'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
