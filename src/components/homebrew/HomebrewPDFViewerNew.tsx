'use client';

/**
 * Modern PDF Viewer Component
 *
 * Uses PDF.js for client-side viewing with:
 * - Table of Contents navigation
 * - Full-text search
 * - Page navigation and zoom controls
 * - Responsive canvas rendering
 */

import { useEffect, useRef, useState } from 'react';
import { PDFViewer, TOCItem, SearchResult } from '@/lib/pdf-viewer';
import { Card, Button, TextField, Box, Flex, Text, ScrollArea, Separator } from '@radix-ui/themes';
import { MagnifyingGlassIcon, ChevronLeftIcon, ChevronRightIcon, BookmarkIcon } from '@radix-ui/react-icons';

interface HomebrewPDFViewerNewProps {
  pdfUrl: string;
  title?: string;
}

export default function HomebrewPDFViewerNew({ pdfUrl, title }: HomebrewPDFViewerNewProps) {
  const [viewer] = useState(() => new PDFViewer());
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.5);
  const [toc, setToc] = useState<TOCItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showToc, setShowToc] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load PDF on mount
  useEffect(() => {
    async function loadPDF() {
      try {
        setLoading(true);
        setError(null);

        const result = await viewer.loadPDF(pdfUrl);

        setNumPages(result.numPages);
        setToc(result.toc);

        console.log(`[PDFViewer] Loaded PDF with ${result.numPages} pages`);
        console.log(`[PDFViewer] TOC entries: ${result.toc.length}`);

      } catch (err) {
        console.error('[PDFViewer] Error loading PDF:', err);
        setError(err instanceof Error ? err.message : 'Failed to load PDF');
      } finally {
        setLoading(false);
      }
    }

    loadPDF();

    // Cleanup on unmount
    return () => {
      viewer.destroy();
    };
  }, [pdfUrl, viewer]);

  // Render current page when page or scale changes
  useEffect(() => {
    async function render() {
      if (!canvasRef.current || numPages === 0) return;

      try {
        await viewer.renderPage(currentPage, canvasRef.current, scale);
      } catch (err) {
        console.error('[PDFViewer] Error rendering page:', err);
        setError('Failed to render page');
      }
    }

    render();
  }, [currentPage, scale, numPages, viewer]);

  // Handle search
  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const results = viewer.search(searchQuery);
    setSearchResults(results);

    // Jump to first result if available
    if (results.length > 0) {
      setCurrentPage(results[0].page);
    }
  };

  // Navigate to page from TOC
  const handleTocClick = (page: number) => {
    setCurrentPage(page);
    setShowToc(false);
  };

  // Page navigation
  const goToPage = (page: number) => {
    if (page >= 1 && page <= numPages) {
      setCurrentPage(page);
    }
  };

  // Zoom controls
  const zoomIn = () => setScale(prev => Math.min(prev + 0.25, 3.0));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));

  // Render TOC tree recursively
  const renderTocTree = (items: TOCItem[], level: number = 0) => {
    return (
      <Box pl={level > 0 ? '4' : '0'}>
        {items.map((item, index) => (
          <Box key={`${item.page}-${index}`}>
            <Button
              variant="ghost"
              size="2"
              onClick={() => handleTocClick(item.page)}
              style={{
                width: '100%',
                justifyContent: 'flex-start',
                fontSize: level > 0 ? '13px' : '14px',
                fontWeight: level === 0 ? '500' : '400'
              }}
            >
              <Text truncate>{item.title}</Text>
              <Text size="1" color="gray" ml="auto">p.{item.page}</Text>
            </Button>
            {item.items && item.items.length > 0 && renderTocTree(item.items, level + 1)}
          </Box>
        ))}
      </Box>
    );
  };

  if (loading) {
    return (
      <Card>
        <Flex align="center" justify="center" p="9">
          <Text>Loading PDF...</Text>
        </Flex>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <Flex direction="column" align="center" justify="center" p="9" gap="4">
          <Text color="red" size="3">Error: {error}</Text>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </Flex>
      </Card>
    );
  }

  return (
    <Box>
      {/* Header with title and controls */}
      <Card mb="3">
        <Flex direction="column" gap="3">
          {title && (
            <Text size="5" weight="bold">{title}</Text>
          )}

          {/* Search bar */}
          <Flex gap="2" align="center">
            <Box style={{ flex: 1 }}>
              <TextField.Root
                placeholder="Search PDF..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              >
                <TextField.Slot>
                  <MagnifyingGlassIcon height="16" width="16" />
                </TextField.Slot>
              </TextField.Root>
            </Box>
            <Button onClick={handleSearch} variant="solid">
              Search
            </Button>
            {toc.length > 0 && (
              <Button onClick={() => setShowToc(!showToc)} variant="soft">
                <BookmarkIcon />
                {showToc ? 'Hide' : 'Show'} TOC
              </Button>
            )}
          </Flex>

          {/* Search results */}
          {searchResults.length > 0 && (
            <Box>
              <Text size="2" color="gray" mb="2">
                Found {searchResults.length} results
              </Text>
              <ScrollArea style={{ maxHeight: '150px' }}>
                <Flex direction="column" gap="1">
                  {searchResults.slice(0, 20).map((result, idx) => (
                    <Button
                      key={idx}
                      variant="ghost"
                      size="1"
                      onClick={() => setCurrentPage(result.page)}
                      style={{ justifyContent: 'flex-start' }}
                    >
                      <Text size="1">
                        <strong>Page {result.page}:</strong> ...{result.context}...
                      </Text>
                    </Button>
                  ))}
                </Flex>
              </ScrollArea>
            </Box>
          )}
        </Flex>
      </Card>

      {/* Main content area */}
      <Flex gap="3">
        {/* Table of Contents Sidebar */}
        {showToc && toc.length > 0 && (
          <Card style={{ width: '300px', flexShrink: 0 }}>
            <Text size="3" weight="bold" mb="3">Table of Contents</Text>
            <Separator size="4" mb="3" />
            <ScrollArea style={{ height: '70vh' }}>
              {renderTocTree(toc)}
            </ScrollArea>
          </Card>
        )}

        {/* PDF Viewer */}
        <Card style={{ flex: 1 }}>
          {/* Page controls */}
          <Flex justify="between" align="center" mb="3" wrap="wrap" gap="2">
            <Flex gap="2" align="center">
              <Button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                size="2"
              >
                <ChevronLeftIcon />
                Previous
              </Button>
              <Text size="2">
                Page {currentPage} / {numPages}
              </Text>
              <Button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= numPages}
                size="2"
              >
                Next
                <ChevronRightIcon />
              </Button>
            </Flex>

            {/* Zoom controls */}
            <Flex gap="2" align="center">
              <Button onClick={zoomOut} size="2" variant="soft">
                -
              </Button>
              <Text size="2">{Math.round(scale * 100)}%</Text>
              <Button onClick={zoomIn} size="2" variant="soft">
                +
              </Button>
            </Flex>
          </Flex>

          {/* Canvas container */}
          <Box
            ref={containerRef}
            style={{
              overflow: 'auto',
              maxHeight: '75vh',
              display: 'flex',
              justifyContent: 'center',
              backgroundColor: 'var(--gray-3)',
              padding: '1rem',
              borderRadius: 'var(--radius-3)',
            }}
          >
            <canvas
              ref={canvasRef}
              style={{
                maxWidth: '100%',
                height: 'auto',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
            />
          </Box>
        </Card>
      </Flex>
    </Box>
  );
}
