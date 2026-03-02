import { SourceCard } from './_components/source-card'

const SOURCE_META = [
  { source: 'notion',        label: 'Notion',        description: 'Import pages from your Notion workspace',       authMode: 'api' as const },
  { source: 'obsidian',      label: 'Obsidian',       description: 'Upload an Obsidian vault ZIP',                  authMode: 'file' as const },
  { source: 'google_docs',   label: 'Google Docs',    description: 'Import from a shareable Google Doc URL',        authMode: 'both' as const },
  { source: 'docx',          label: 'Word (.docx)',   description: 'Upload a Word document',                        authMode: 'file' as const },
  { source: 'markdown_file', label: 'Markdown',       description: 'Upload .md files',                              authMode: 'file' as const },
  { source: 'world_anvil',   label: 'World Anvil',    description: 'API sync or XML export upload',                 authMode: 'both' as const },
  { source: 'campfire',      label: 'Campfire',       description: 'Upload a Campfire JSON export',                 authMode: 'file' as const },
  { source: 'kanka',         label: 'Kanka',          description: 'API sync or JSON export upload',                authMode: 'both' as const },
]

export default function ImportHubPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Import Content</h1>
        <p className="text-muted-foreground">
          Bring your homebrew content from any platform into QuiverDM.
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {SOURCE_META.map((meta) => (
          <SourceCard key={meta.source} {...meta} />
        ))}
      </div>
    </div>
  )
}
