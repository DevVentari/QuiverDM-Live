'use client';

import { useState, useMemo } from 'react';
import { Button, Card, Flex, Text, Checkbox, Box, Select } from '@radix-ui/themes';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { formatFileSize } from '@/lib/utils/format';
import { useFileUpload } from '@/hooks/useFileUpload';

interface HomebrewPDFUploadProps {
  campaignId?: string; // Optional - if provided, PDF is campaign-specific
  onUploadComplete?: (pdfId: string) => void;
}

export function HomebrewPDFUpload({ campaignId, onUploadComplete }: HomebrewPDFUploadProps) {
  const [useAIExtraction, setUseAIExtraction] = useState(true);
  const [llmProvider, setLlmProvider] = useState<'gemini' | 'anthropic' | 'openai'>('gemini');

  const utils = trpc.useUtils();

  // Build form data based on current options
  const formData = useMemo(() => {
    const data: Record<string, string> = {
      useAIExtraction: useAIExtraction.toString(),
      useMarkerLLM: 'false',
      llmProvider,
    };
    if (campaignId) {
      data.campaignId = campaignId;
    }
    return data;
  }, [useAIExtraction, llmProvider, campaignId]);

  const upload = useFileUpload({
    endpoint: '/api/homebrew/upload-pdf',
    accept: '.pdf,application/pdf',
    maxSize: 50 * 1024 * 1024, // 50MB
    formData,
    onSuccess: async (data) => {
      if (!data.pdf || !data.pdf.id) {
        throw new Error('Invalid response from server');
      }

      // Invalidate queries to refresh lists
      await utils.homebrewPdf.getPDFs.invalidate();
      await utils.homebrewPdf.getStats.invalidate();

      // Reset form
      upload.reset();
      setUseAIExtraction(true);
      setLlmProvider('gemini');

      // Call callback
      if (onUploadComplete) {
        onUploadComplete(data.pdf.id);
      }
    },
    onError: (error) => {
      console.error('Upload error:', error);
    },
  });

  const handleUpload = async () => {
    try {
      await upload.upload();
    } catch {
      // Error already handled by onError
    }
  };

  return (
    <Card>
      <Flex direction="column" gap="4">
        <div
          className={`
            border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
            ${upload.isDragActive ? 'border-purple-500 bg-purple-500/10' : 'border-gray-600'}
            ${upload.file ? 'border-green-500 bg-green-500/10' : ''}
            ${!upload.file && !upload.isUploading ? 'hover:border-purple-400 hover:bg-purple-500/5' : ''}
          `}
          {...upload.getRootProps()}
        >
          <input {...upload.getInputProps()} />

          {!upload.file ? (
            <Flex direction="column" align="center" gap="3">
              <Upload size={48} className="text-gray-500" />
              <Text size="3" weight="medium">
                Drop PDF here or click to browse
              </Text>
              <Text size="2" color="gray">
                Maximum file size: 50MB
              </Text>
            </Flex>
          ) : (
            <Flex direction="column" align="center" gap="3">
              <FileText size={48} className="text-green-500" />
              <Text size="3" weight="medium">
                {upload.file.name}
              </Text>
              <Text size="2" color="gray">
                {formatFileSize(upload.file.size)}
              </Text>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  upload.clearFile();
                }}
                variant="soft"
                color="gray"
                disabled={upload.isUploading}
              >
                Change File
              </Button>
            </Flex>
          )}
        </div>

        {upload.file && (
          <Flex direction="column" gap="3">
            <Box>
              <label>
                <Flex gap="2" align="center">
                  <Checkbox
                    checked={useAIExtraction}
                    onCheckedChange={(checked) => setUseAIExtraction(checked === true)}
                    disabled={upload.isUploading}
                  />
                  <Flex direction="column" gap="1">
                    <Text size="2" weight="medium">
                      Extract D&D Content (Recommended)
                    </Text>
                    <Text size="1" color="gray">
                      Use AI to identify items, spells, creatures (~$0.01-0.05/doc)
                    </Text>
                  </Flex>
                </Flex>
              </label>
            </Box>

            {useAIExtraction && (
              <Box>
                <Text size="2" weight="medium" mb="2">
                  AI Provider for Content Extraction
                </Text>
                <Select.Root
                  value={llmProvider}
                  onValueChange={(value) => setLlmProvider(value as typeof llmProvider)}
                  disabled={upload.isUploading}
                >
                  <Select.Trigger />
                  <Select.Content>
                    <Select.Item value="gemini">
                      Gemini 2.0 Flash (Fastest, ~$0.01/doc)
                    </Select.Item>
                    <Select.Item value="anthropic">
                      Claude Sonnet 4 (Most Accurate, ~$0.03/doc)
                    </Select.Item>
                    <Select.Item value="openai">
                      GPT-4o Mini (Balanced, ~$0.02/doc)
                    </Select.Item>
                  </Select.Content>
                </Select.Root>
              </Box>
            )}

            <Button
              onClick={handleUpload}
              disabled={upload.isUploading}
              size="3"
            >
              {upload.isUploading ? 'Uploading...' : 'Upload and Process'}
            </Button>
          </Flex>
        )}

        {upload.error && (
          <Flex gap="2" align="center" style={{ color: 'var(--red-9)' }}>
            <AlertCircle size={16} />
            <Text size="2">{upload.error}</Text>
          </Flex>
        )}

        {upload.isUploading && (
          <Text size="2" color="gray">
            Uploading file... Processing will continue in the background.
          </Text>
        )}
      </Flex>
    </Card>
  );
}
