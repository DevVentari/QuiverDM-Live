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
  DropdownMenu,
  AlertDialog,
} from '@radix-ui/themes';
import {
  FileText,
  MoreVertical,
  Eye,
  Download,
  Trash2,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PDFProgressIndicator } from './PDFProgressIndicator';

interface HomebrewPDFListProps {
  campaignId?: string; // Optional - filter by campaign
  onViewPDF?: (pdfId: string) => void;
}

export function HomebrewPDFList({ campaignId, onViewPDF }: HomebrewPDFListProps) {
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pdfToDelete, setPdfToDelete] = useState<string | null>(null);

  const utils = trpc.useUtils();

  // Fetch PDFs
  const { data, isLoading, error } = trpc.homebrewPdf.getPDFs.useQuery({
    campaignId,
    limit: 50,
  });

  // Delete mutation
  const deleteMutation = trpc.homebrewPdf.deletePDF.useMutation({
    onSuccess: () => {
      utils.homebrewPdf.getPDFs.invalidate();
      utils.homebrewPdf.getStats.invalidate();
      setDeleteDialogOpen(false);
      setPdfToDelete(null);
    },
  });

  // Toggle LLM mutation
  const toggleLLMMutation = trpc.homebrewPdf.toggleLLMMode.useMutation({
    onSuccess: () => {
      utils.homebrewPdf.getPDFs.invalidate();
    },
  });

  // Process mutation (for retrying failed PDFs)
  const processMutation = trpc.homebrewPdf.processPDF.useMutation({
    onSuccess: () => {
      utils.homebrewPdf.getPDFs.invalidate();
    },
  });

  // Extract content mutation
  const extractMutation = trpc.homebrewPdf.extractContent.useMutation({
    onSuccess: (result) => {
      utils.homebrewPdf.getPDFs.invalidate();
      utils.homebrew.getContent.invalidate();
      utils.homebrew.getContentStats.invalidate();
      alert(`${result.message}\nTokens used: ${result.tokensUsed || 0}`);
    },
    onError: (error) => {
      alert(`Extraction failed: ${error.message}`);
    },
  });

  const handleExtract = async (pdfId: string) => {
    if (extractMutation.isPending) return;
    await extractMutation.mutateAsync({ pdfId });
  };

  const handleDelete = async (pdfId: string) => {
    setPdfToDelete(pdfId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (pdfToDelete) {
      await deleteMutation.mutateAsync({ pdfId: pdfToDelete });
    }
  };

  const handleView = (pdfId: string) => {
    if (onViewPDF) {
      onViewPDF(pdfId);
    } else {
      router.push(`/homebrew/pdf/${pdfId}`);
    }
  };

  const handleDownload = async (r2Url: string, filename: string) => {
    try {
      const response = await fetch(r2Url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const handleToggleLLM = async (pdfId: string, currentUseLLM: boolean) => {
    await toggleLLMMutation.mutateAsync({
      pdfId,
      useLLM: !currentUseLLM,
    });
  };

  const handleRetry = async (pdfId: string) => {
    await processMutation.mutateAsync({ pdfId });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge color="gray">
            <Clock size={12} />
            Pending
          </Badge>
        );
      case 'processing':
        return (
          <Badge color="blue">
            <Loader2 size={12} className="animate-spin" />
            Processing
          </Badge>
        );
      case 'completed':
        return (
          <Badge color="green">
            <CheckCircle size={12} />
            Ready
          </Badge>
        );
      case 'failed':
        return (
          <Badge color="red">
            <XCircle size={12} />
            Failed
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(date));
  };

  if (isLoading) {
    return (
      <Flex justify="center" align="center" style={{ minHeight: '200px' }}>
        <Loader2 size={32} className="animate-spin text-purple-500" />
      </Flex>
    );
  }

  if (error) {
    return (
      <Card>
        <Flex gap="2" align="center" style={{ color: 'var(--red-9)' }}>
          <XCircle size={16} />
          <Text size="2">Failed to load PDFs: {error.message}</Text>
        </Flex>
      </Card>
    );
  }

  if (!data?.items || data.items.length === 0) {
    return (
      <Card>
        <Flex direction="column" align="center" gap="2" style={{ padding: '2rem' }}>
          <FileText size={48} className="text-gray-500" />
          <Text size="3" color="gray">
            No PDFs uploaded yet
          </Text>
        </Flex>
      </Card>
    );
  }

  return (
    <>
      <Flex direction="column" gap="3">
        {data.items.map((pdf) => (
          <Card key={pdf.id}>
            <Flex gap="3" align="start">
              <Box style={{ flexShrink: 0 }}>
                <FileText size={40} className="text-purple-500" />
              </Box>

              <Flex direction="column" gap="2" style={{ flex: 1, minWidth: 0 }}>
                <Flex justify="between" align="start" gap="2">
                  <Flex direction="column" gap="1" style={{ flex: 1, minWidth: 0 }}>
                    <Text size="3" weight="medium" style={{ wordBreak: 'break-word' }}>
                      {pdf.filename}
                    </Text>
                    <Flex gap="2" wrap="wrap">
                      {getStatusBadge(pdf.processingStatus)}
                      {pdf.useLLM && <Badge color="purple">AI Enhanced</Badge>}
                      {pdf.markerMetadata && (pdf.markerMetadata as any).itemsExtracted > 0 && (
                        <Badge color="green">
                          <Sparkles size={12} />
                          {(pdf.markerMetadata as any).itemsExtracted} items extracted
                        </Badge>
                      )}
                      {pdf.markerMetadata && (
                        <Text size="1" color="gray">
                          {(pdf.markerMetadata as any).pages} pages
                        </Text>
                      )}
                      <Text size="1" color="gray">
                        {formatFileSize(pdf.fileSize)}
                      </Text>
                    </Flex>
                  </Flex>

                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger>
                      <Button variant="ghost" size="1">
                        <MoreVertical size={16} />
                      </Button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content>
                      <DropdownMenu.Item onClick={() => handleView(pdf.id)}>
                        <Eye size={14} />
                        View
                      </DropdownMenu.Item>
                      <DropdownMenu.Item onClick={() => handleDownload(pdf.r2Url, pdf.filename)}>
                        <Download size={14} />
                        Download PDF
                      </DropdownMenu.Item>
                      {pdf.processingStatus === 'completed' && (
                        <>
                          <DropdownMenu.Item
                            onClick={() => handleExtract(pdf.id)}
                            disabled={extractMutation.isPending}
                          >
                            <Sparkles size={14} />
                            {extractMutation.isPending ? 'Extracting...' : 'Extract Content'}
                          </DropdownMenu.Item>
                          <DropdownMenu.Item onClick={() => handleToggleLLM(pdf.id, pdf.useLLM)}>
                            <RefreshCw size={14} />
                            {pdf.useLLM ? 'Disable' : 'Enable'} AI Enhancement
                          </DropdownMenu.Item>
                        </>
                      )}
                      {pdf.processingStatus === 'failed' && (
                        <DropdownMenu.Item onClick={() => handleRetry(pdf.id)}>
                          <RefreshCw size={14} />
                          Retry Processing
                        </DropdownMenu.Item>
                      )}
                      <DropdownMenu.Separator />
                      <DropdownMenu.Item color="red" onClick={() => handleDelete(pdf.id)}>
                        <Trash2 size={14} />
                        Delete
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Root>
                </Flex>

                {pdf.errorMessage && (
                  <Text size="1" style={{ color: 'var(--red-9)' }}>
                    Error: {pdf.errorMessage}
                  </Text>
                )}

                {/* Show real-time progress for processing PDFs */}
                {(pdf.processingStatus === 'processing' || pdf.processingStatus === 'pending') && (
                  <PDFProgressIndicator
                    pdfId={pdf.id}
                    compact={true}
                    onComplete={() => {
                      // Refresh the list when processing completes
                      utils.homebrewPdf.getPDFs.invalidate();
                      utils.homebrewPdf.getStats.invalidate();
                      utils.homebrew.getContent.invalidate();
                    }}
                    onError={(error) => {
                      console.error(`[HomebrewPDFList] PDF ${pdf.id} failed:`, error);
                      utils.homebrewPdf.getPDFs.invalidate();
                    }}
                  />
                )}

                <Text size="1" color="gray">
                  Uploaded {formatDate(pdf.createdAt)}
                </Text>
              </Flex>
            </Flex>
          </Card>
        ))}
      </Flex>

      <AlertDialog.Root open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialog.Content>
          <AlertDialog.Title>Delete PDF</AlertDialog.Title>
          <AlertDialog.Description>
            Are you sure you want to delete this PDF? This action cannot be undone.
          </AlertDialog.Description>
          <Flex gap="3" mt="4" justify="end">
            <AlertDialog.Cancel>
              <Button variant="soft" color="gray">
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action>
              <Button
                color="red"
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </>
  );
}
