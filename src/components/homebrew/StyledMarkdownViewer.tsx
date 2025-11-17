'use client';

import { useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, Flex, Text, Box, Heading, Badge, Separator, Button, Select } from '@radix-ui/themes';
import { FileText, Loader2, AlertCircle, BookOpen, Sparkles, CheckCircle2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface StyledMarkdownViewerProps {
  pdfId: string;
}

export function StyledMarkdownViewer({ pdfId }: StyledMarkdownViewerProps) {
  const { data: pdf, isLoading, error } = trpc.homebrewPdf.getPDF.useQuery({ pdfId });
  const [provider, setProvider] = useState<'gemini' | 'anthropic' | 'openai'>('openai');
  const [extractionResult, setExtractionResult] = useState<{
    success: boolean;
    extractedCount: number;
    savedItems: Array<{ id: string; type: string; name: string }>;
    tokensUsed?: number;
  } | null>(null);

  const extractMutation = trpc.homebrewExtraction.extractWithProvider.useMutation({
    onSuccess: (data) => {
      setExtractionResult(data);
    },
  });

  const markdownStyles = useMemo(
    () => `
    .dnd-markdown {
      font-family: 'Bookinsanity', Georgia, serif;
      line-height: 1.6;
      color: var(--gray-12);
      background: var(--gray-1);
      padding: 2rem;
      border-radius: 8px;
    }

    .dnd-markdown h1 {
      font-family: 'Nodesto Caps Condensed', 'Libre Baskerville', serif;
      font-size: 2.5rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--violet-11);
      margin-bottom: 0.5rem;
      text-align: center;
      border-bottom: 3px solid var(--violet-8);
      padding-bottom: 0.5rem;
    }

    .dnd-markdown h2 {
      font-family: 'Nodesto Caps Condensed', 'Libre Baskerville', serif;
      font-size: 1.8rem;
      font-weight: 600;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      color: var(--violet-10);
      margin-top: 2rem;
      margin-bottom: 0.75rem;
      border-bottom: 2px solid var(--violet-6);
      padding-bottom: 0.25rem;
      padding-left: 0.75rem;
      border-left: 4px solid var(--violet-9);
    }

    .dnd-markdown h3 {
      font-family: 'Scaly Sans Caps', 'Arial', sans-serif;
      font-size: 1.3rem;
      font-weight: 600;
      color: var(--violet-11);
      margin-top: 1.5rem;
      margin-bottom: 0.5rem;
      border-bottom: 1px solid var(--gray-6);
      padding-bottom: 0.25rem;
    }

    .dnd-markdown h4 {
      font-family: 'Scaly Sans Caps', 'Arial', sans-serif;
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--gray-12);
      margin-top: 1rem;
      margin-bottom: 0.25rem;
    }

    .dnd-markdown p {
      margin-bottom: 1rem;
      text-align: justify;
    }

    .dnd-markdown p:first-of-type::first-letter {
      font-size: 1.5em;
      font-weight: bold;
      color: var(--violet-10);
    }

    .dnd-markdown ul, .dnd-markdown ol {
      margin-left: 1.5rem;
      margin-bottom: 1rem;
    }

    .dnd-markdown li {
      margin-bottom: 0.5rem;
      position: relative;
    }

    .dnd-markdown ul > li::marker {
      color: var(--violet-9);
    }

    .dnd-markdown ol > li::marker {
      color: var(--violet-9);
      font-weight: bold;
    }

    .dnd-markdown strong {
      font-weight: 700;
      color: var(--gray-12);
    }

    .dnd-markdown em {
      font-style: italic;
      color: var(--gray-11);
    }

    .dnd-markdown blockquote {
      background: var(--violet-2);
      border-left: 4px solid var(--violet-9);
      padding: 1rem 1.5rem;
      margin: 1.5rem 0;
      border-radius: 0 8px 8px 0;
      font-style: italic;
    }

    .dnd-markdown blockquote p {
      margin-bottom: 0;
    }

    .dnd-markdown code {
      background: var(--gray-3);
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.9em;
    }

    .dnd-markdown pre {
      background: var(--gray-3);
      padding: 1rem;
      border-radius: 8px;
      overflow-x: auto;
      margin-bottom: 1rem;
    }

    .dnd-markdown pre code {
      background: none;
      padding: 0;
    }

    .dnd-markdown table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.5rem 0;
    }

    .dnd-markdown th {
      background: var(--violet-3);
      color: var(--violet-11);
      font-weight: 600;
      padding: 0.75rem;
      text-align: left;
      border-bottom: 2px solid var(--violet-6);
    }

    .dnd-markdown td {
      padding: 0.5rem 0.75rem;
      border-bottom: 1px solid var(--gray-5);
    }

    .dnd-markdown tr:nth-child(even) {
      background: var(--gray-2);
    }

    .dnd-markdown hr {
      border: none;
      height: 2px;
      background: linear-gradient(90deg, transparent, var(--violet-6), transparent);
      margin: 2rem 0;
    }

    .dnd-markdown a {
      color: var(--violet-11);
      text-decoration: underline;
      text-decoration-color: var(--violet-6);
      text-underline-offset: 2px;
    }

    .dnd-markdown a:hover {
      color: var(--violet-12);
      text-decoration-color: var(--violet-9);
    }

    .dnd-markdown img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 1rem 0;
    }

    /* Stat block styling */
    .dnd-markdown .stat-block {
      background: var(--amber-2);
      border: 2px solid var(--amber-8);
      padding: 1rem;
      border-radius: 8px;
      margin: 1rem 0;
    }
  `,
    []
  );

  if (isLoading) {
    return (
      <Flex justify="center" align="center" style={{ minHeight: '400px' }}>
        <Loader2 size={48} className="animate-spin text-purple-500" />
      </Flex>
    );
  }

  if (error) {
    return (
      <Card>
        <Flex gap="2" align="center" style={{ color: 'var(--red-9)' }}>
          <AlertCircle size={20} />
          <Text size="3">Failed to load PDF: {error.message}</Text>
        </Flex>
      </Card>
    );
  }

  if (!pdf) {
    return (
      <Card>
        <Flex gap="2" align="center" style={{ color: 'var(--red-9)' }}>
          <AlertCircle size={20} />
          <Text size="3">PDF not found</Text>
        </Flex>
      </Card>
    );
  }

  if (!pdf.markdownContent) {
    return (
      <Card>
        <Flex direction="column" align="center" gap="4" p="6">
          <FileText size={64} className="text-gray-500" />
          <Text size="4" color="gray" align="center">
            No markdown content available yet.
          </Text>
          <Text size="2" color="gray" align="center">
            {pdf.processingStatus === 'processing'
              ? 'PDF is currently being processed...'
              : pdf.processingStatus === 'pending'
                ? 'PDF is queued for processing...'
                : 'Process this PDF to generate markdown content.'}
          </Text>
        </Flex>
      </Card>
    );
  }

  return (
    <Flex direction="column" gap="4">
      {/* Header */}
      <Card>
        <Flex gap="3" align="center">
          <BookOpen size={24} className="text-purple-500" />
          <Flex direction="column" gap="1" style={{ flex: 1 }}>
            <Heading size="5">{pdf.filename}</Heading>
            <Flex gap="2" wrap="wrap">
              <Badge color="green">Processed</Badge>
              {pdf.markerMetadata && (
                <>
                  <Text size="2" color="gray">
                    {(pdf.markerMetadata as any).pages || '?'} pages
                  </Text>
                  {(pdf.markerMetadata as any).itemsExtracted > 0 && (
                    <Badge color="purple">
                      {(pdf.markerMetadata as any).itemsExtracted} items extracted
                    </Badge>
                  )}
                </>
              )}
            </Flex>
          </Flex>
        </Flex>
      </Card>

      {/* AI Extraction Panel */}
      <Card>
        <Flex direction="column" gap="3">
          <Flex align="center" gap="2">
            <Sparkles size={20} className="text-purple-500" />
            <Heading size="4">AI Content Extraction</Heading>
          </Flex>

          <Text size="2" color="gray">
            Extract D&D content (items, spells, creatures, feats) from this document using AI.
          </Text>

          <Flex gap="3" align="center" wrap="wrap">
            <Select.Root
              value={provider}
              onValueChange={(value) => setProvider(value as typeof provider)}
              disabled={extractMutation.isPending}
            >
              <Select.Trigger placeholder="Select AI Provider" />
              <Select.Content>
                <Select.Item value="openai">OpenAI GPT-4o Mini (~$0.02/doc)</Select.Item>
                <Select.Item value="gemini">Gemini 2.0 Flash (~$0.01/doc)</Select.Item>
                <Select.Item value="anthropic">Claude Sonnet 4 (~$0.03/doc)</Select.Item>
              </Select.Content>
            </Select.Root>

            <Button
              onClick={() => extractMutation.mutate({ pdfId, provider })}
              disabled={extractMutation.isPending}
              size="3"
            >
              {extractMutation.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Extract Content
                </>
              )}
            </Button>
          </Flex>

          {extractMutation.isError && (
            <Flex gap="2" align="center" style={{ color: 'var(--red-9)' }}>
              <AlertCircle size={16} />
              <Text size="2">{extractMutation.error.message}</Text>
            </Flex>
          )}

          {extractionResult && (
            <Card style={{ background: 'var(--green-2)', border: '1px solid var(--green-6)' }}>
              <Flex direction="column" gap="2">
                <Flex align="center" gap="2">
                  <CheckCircle2 size={20} style={{ color: 'var(--green-9)' }} />
                  <Text size="3" weight="medium">
                    Extracted {extractionResult.extractedCount} items successfully!
                  </Text>
                </Flex>
                {extractionResult.tokensUsed && (
                  <Text size="1" color="gray">
                    Tokens used: {extractionResult.tokensUsed.toLocaleString()}
                  </Text>
                )}
                <Separator size="4" />
                <Text size="2" weight="medium">Saved to Homebrew Library:</Text>
                <Box style={{ maxHeight: '200px', overflow: 'auto' }}>
                  {extractionResult.savedItems.map((item) => (
                    <Flex key={item.id} gap="2" align="center" py="1">
                      <Badge color="purple" size="1">{item.type}</Badge>
                      <Text size="2">{item.name}</Text>
                    </Flex>
                  ))}
                </Box>
              </Flex>
            </Card>
          )}
        </Flex>
      </Card>

      {/* Styled Markdown Content */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <style>{markdownStyles}</style>
        <Box className="dnd-markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{pdf.markdownContent}</ReactMarkdown>
        </Box>
      </Card>
    </Flex>
  );
}
