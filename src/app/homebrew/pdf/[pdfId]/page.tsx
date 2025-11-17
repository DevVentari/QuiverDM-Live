'use client';

import { StyledMarkdownViewer } from '@/components/homebrew/StyledMarkdownViewer';
import { Container, Heading, Flex, Button } from '@radix-ui/themes';
import { ArrowLeft, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function PDFViewerPage() {
  const params = useParams();
  const pdfId = params?.pdfId as string;

  return (
    <Container size="4" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
      <Flex direction="column" gap="4">
        <Flex align="center" gap="3">
          <Link href="/homebrew">
            <Button variant="ghost" size="2">
              <ArrowLeft size={16} />
              Back to Library
            </Button>
          </Link>
          <BookOpen size={20} className="text-purple-500" />
          <Heading size="6">Homebrew Document</Heading>
        </Flex>

        <StyledMarkdownViewer pdfId={pdfId} />
      </Flex>
    </Container>
  );
}
