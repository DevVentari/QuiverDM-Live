'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import {
  Card,
  Flex,
  Text,
  Button,
  Badge,
  Box,
  Tabs,
  ScrollArea,
} from '@radix-ui/themes';
import {
  FileText,
  Download,
  Loader2,
  XCircle,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface HomebrewPDFViewerProps {
  pdfId: string;
}

export function HomebrewPDFViewer({ pdfId }: HomebrewPDFViewerProps) {
  const [showMarkdown, setShowMarkdown] = useState(false);
  const [pdfViewerError, setPdfViewerError] = useState<string | null>(null);

  // Fetch PDF data
  const { data: pdf, isLoading, error } = trpc.homebrewPdf.getPDF.useQuery({ pdfId });

  // Fetch presigned URL for PDF viewing (only when PDF is completed)
  const { data: presignedData, isLoading: isLoadingPresigned } = trpc.homebrewPdf.getPresignedUrl.useQuery(
    { pdfId, expiresIn: 3600 }, // 1 hour expiration
    { enabled: !!pdf && pdf.processingStatus === 'completed' }
  );

  const handleDownloadPDF = async () => {
    if (!pdf) return;
    try {
      const response = await fetch(pdf.r2Url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pdf.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const handleDownloadMarkdown = () => {
    if (!pdf?.markdownContent) return;
    const blob = new Blob([pdf.markdownContent], { type: 'text/markdown' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pdf.filename.replace('.pdf', '')}.md`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          icon: <Clock size={16} />,
          color: 'gray' as const,
          text: 'Pending',
        };
      case 'processing':
        return {
          icon: <Loader2 size={16} className="animate-spin" />,
          color: 'blue' as const,
          text: 'Processing',
        };
      case 'completed':
        return {
          icon: <CheckCircle size={16} />,
          color: 'green' as const,
          text: 'Ready',
        };
      case 'failed':
        return {
          icon: <XCircle size={16} />,
          color: 'red' as const,
          text: 'Failed',
        };
      default:
        return {
          icon: <FileText size={16} />,
          color: 'gray' as const,
          text: status,
        };
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <Flex justify="center" align="center" style={{ minHeight: '400px' }}>
        <Loader2 size={48} className="animate-spin text-purple-500" />
      </Flex>
    );
  }

  if (error || !pdf) {
    return (
      <Card>
        <Flex gap="2" align="center" style={{ color: 'var(--red-9)' }}>
          <XCircle size={16} />
          <Text size="2">Failed to load PDF: {error?.message || 'Not found'}</Text>
        </Flex>
      </Card>
    );
  }

  const statusInfo = getStatusInfo(pdf.processingStatus);

  return (
    <Flex direction="column" gap="4">
      {/* Header Card */}
      <Card>
        <Flex direction="column" gap="3">
          <Flex justify="between" align="start" gap="3">
            <Flex direction="column" gap="2" style={{ flex: 1 }}>
              <Text size="5" weight="bold">
                {pdf.filename}
              </Text>
              <Flex gap="2" wrap="wrap">
                <Badge color={statusInfo.color}>
                  {statusInfo.icon}
                  {statusInfo.text}
                </Badge>
                {pdf.useLLM && <Badge color="purple">AI Enhanced</Badge>}
                {pdf.campaign && (
                  <Badge color="blue">{pdf.campaign.name}</Badge>
                )}
                {pdf.markerMetadata && (
                  <Text size="2" color="gray">
                    {(pdf.markerMetadata as any).pages} pages
                  </Text>
                )}
                <Text size="2" color="gray">
                  {formatFileSize(pdf.fileSize)}
                </Text>
              </Flex>
            </Flex>

            <Flex gap="2">
              <Button onClick={handleDownloadPDF} variant="soft">
                <Download size={16} />
                Download PDF
              </Button>
              {pdf.markdownContent && (
                <Button onClick={handleDownloadMarkdown} variant="soft">
                  <Download size={16} />
                  Download Markdown
                </Button>
              )}
            </Flex>
          </Flex>

          {pdf.errorMessage && (
            <Box
              style={{
                padding: '0.75rem',
                backgroundColor: 'var(--red-3)',
                borderRadius: 'var(--radius-2)',
              }}
            >
              <Text size="2" style={{ color: 'var(--red-11)' }}>
                Error: {pdf.errorMessage}
              </Text>
            </Box>
          )}

          {pdf.processingStatus === 'processing' && (
            <Box
              style={{
                padding: '0.75rem',
                backgroundColor: 'var(--blue-3)',
                borderRadius: 'var(--radius-2)',
              }}
            >
              <Text size="2" style={{ color: 'var(--blue-11)' }}>
                PDF is being processed. This may take a few minutes depending on the file size.
              </Text>
            </Box>
          )}
        </Flex>
      </Card>

      {/* PDF Viewer */}
      {pdf.processingStatus === 'completed' && (
        <Card style={{ padding: 0 }}>
          <Tabs.Root defaultValue="pdf">
            <Tabs.List>
              <Tabs.Trigger value="pdf">PDF View</Tabs.Trigger>
              {pdf.markdownContent && (
                <Tabs.Trigger value="markdown">Markdown (Debug)</Tabs.Trigger>
              )}
            </Tabs.List>

            <Box style={{ padding: '1rem' }}>
              <Tabs.Content value="pdf">
                <Box
                  style={{
                    width: '100%',
                    height: '800px',
                    border: '1px solid var(--gray-6)',
                    borderRadius: 'var(--radius-2)',
                    overflow: 'hidden',
                  }}
                >
                  {isLoadingPresigned ? (
                    <Flex justify="center" align="center" gap="2" style={{ height: '100%' }}>
                      <Loader2 size={32} className="animate-spin text-purple-500" />
                      <Text>Loading PDF viewer...</Text>
                    </Flex>
                  ) : presignedData ? (
                    <embed
                      src={presignedData.url}
                      type="application/pdf"
                      width="100%"
                      height="100%"
                      style={{ border: 'none' }}
                      onError={() => setPdfViewerError('Failed to load PDF. The file may not be accessible.')}
                    />
                  ) : pdfViewerError ? (
                    <Flex justify="center" align="center" direction="column" gap="2" style={{ height: '100%' }}>
                      <XCircle size={48} style={{ color: 'var(--red-9)' }} />
                      <Text size="3" color="red">{pdfViewerError}</Text>
                      <Text size="2" color="gray">Try downloading the PDF instead.</Text>
                    </Flex>
                  ) : (
                    <Flex justify="center" align="center" direction="column" gap="2" style={{ height: '100%' }}>
                      <FileText size={48} style={{ color: 'var(--gray-9)' }} />
                      <Text size="3" color="gray">Pretty print ❌</Text>
                      <Text size="2" color="gray">{`{"error":"File not found"}`}</Text>
                    </Flex>
                  )}
                </Box>
              </Tabs.Content>

              {pdf.markdownContent && (
                <Tabs.Content value="markdown">
                  <ScrollArea
                    style={{
                      height: '800px',
                      border: '1px solid var(--gray-6)',
                      borderRadius: 'var(--radius-2)',
                    }}
                  >
                    <Box style={{ padding: '1rem' }}>
                      <pre
                        style={{
                          whiteSpace: 'pre-wrap',
                          wordWrap: 'break-word',
                          fontFamily: 'monospace',
                          fontSize: '0.875rem',
                          lineHeight: '1.5',
                        }}
                      >
                        {pdf.markdownContent}
                      </pre>
                    </Box>
                  </ScrollArea>
                </Tabs.Content>
              )}
            </Box>
          </Tabs.Root>
        </Card>
      )}

      {/* Metadata */}
      {pdf.markerMetadata && (
        <Card>
          <Flex direction="column" gap="2">
            <Text size="3" weight="bold">
              Processing Details
            </Text>
            <Flex direction="column" gap="1">
              <Text size="2">
                <strong>Pages:</strong> {(pdf.markerMetadata as any).pages || 'N/A'}
              </Text>
              <Text size="2">
                <strong>Processing Time:</strong>{' '}
                {(pdf.markerMetadata as any).processingTime
                  ? `${((pdf.markerMetadata as any).processingTime).toFixed(1)}s`
                  : 'N/A'}
              </Text>
              {(pdf.markerMetadata as any).llmUsed && (
                <>
                  <Text size="2">
                    <strong>LLM Provider:</strong>{' '}
                    {(pdf.markerMetadata as any).llmProvider || 'N/A'}
                  </Text>
                  {(pdf.markerMetadata as any).tokensUsed && (
                    <Text size="2">
                      <strong>Tokens Used:</strong>{' '}
                      {(pdf.markerMetadata as any).tokensUsed.toLocaleString()}
                    </Text>
                  )}
                  {(pdf.markerMetadata as any).estimatedCost && (
                    <Text size="2">
                      <strong>Estimated Cost:</strong> $
                      {(pdf.markerMetadata as any).estimatedCost.toFixed(4)}
                    </Text>
                  )}
                </>
              )}
            </Flex>
          </Flex>
        </Card>
      )}
    </Flex>
  );
}
