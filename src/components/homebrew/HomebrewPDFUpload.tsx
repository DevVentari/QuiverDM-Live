'use client';

import { useState, useRef } from 'react';
import { Button, Card, Flex, Text, Checkbox, Box, Select } from '@radix-ui/themes';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface HomebrewPDFUploadProps {
  campaignId?: string; // Optional - if provided, PDF is campaign-specific
  onUploadComplete?: (pdfId: string) => void;
}

export function HomebrewPDFUpload({ campaignId, onUploadComplete }: HomebrewPDFUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [useAIExtraction, setUseAIExtraction] = useState(true); // Enable extraction by default (cheap)
  const [llmProvider, setLlmProvider] = useState<'gemini' | 'anthropic' | 'openai'>('gemini');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (selectedFile: File) => {
    setError(null);

    // Validate file type
    if (selectedFile.type !== 'application/pdf') {
      setError('Please select a PDF file');
      return;
    }

    // Validate file size (50MB max)
    const maxSize = 50 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      setError('File size exceeds 50MB maximum');
      return;
    }

    setFile(selectedFile);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('useAIExtraction', useAIExtraction.toString());
      formData.append('useMarkerLLM', 'false'); // Disabled for now - causes crashes
      formData.append('llmProvider', llmProvider);
      if (campaignId) {
        formData.append('campaignId', campaignId);
      }

      // Upload to API route
      const response = await fetch('/api/homebrew/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await response.json();

      if (!data.pdf || !data.pdf.id) {
        throw new Error('Invalid response from server');
      }

      // Invalidate queries to refresh lists
      await utils.homebrewPdf.getPDFs.invalidate();
      await utils.homebrewPdf.getStats.invalidate();

      // Reset form
      setFile(null);
      setUseAIExtraction(true);
      setLlmProvider('gemini');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Call callback
      if (onUploadComplete) {
        onUploadComplete(data.pdf.id);
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card>
      <Flex direction="column" gap="4">
        <div
          className={`
            border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
            ${dragActive ? 'border-purple-500 bg-purple-500/10' : 'border-gray-600'}
            ${file ? 'border-green-500 bg-green-500/10' : ''}
            ${!file && !uploading ? 'hover:border-purple-400 hover:bg-purple-500/5' : ''}
          `}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !file && !uploading && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {!file ? (
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
                {file.name}
              </Text>
              <Text size="2" color="gray">
                {formatFileSize(file.size)}
              </Text>
              <Button
                onClick={(e) => {
                  e.stopPropagation(); // Prevent triggering file input
                  setFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                variant="soft"
                color="gray"
                disabled={uploading}
              >
                Change File
              </Button>
            </Flex>
          )}
        </div>

        {file && (
          <Flex direction="column" gap="3">
            <Box>
              <label>
                <Flex gap="2" align="center">
                  <Checkbox
                    checked={useAIExtraction}
                    onCheckedChange={(checked) => setUseAIExtraction(checked === true)}
                    disabled={uploading}
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
                  disabled={uploading}
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
              disabled={uploading}
              size="3"
            >
              {uploading ? 'Uploading...' : 'Upload and Process'}
            </Button>
          </Flex>
        )}

        {error && (
          <Flex gap="2" align="center" style={{ color: 'var(--red-9)' }}>
            <AlertCircle size={16} />
            <Text size="2">{error}</Text>
          </Flex>
        )}

        {uploading && (
          <Text size="2" color="gray">
            Uploading file... Processing will continue in the background.
          </Text>
        )}
      </Flex>
    </Card>
  );
}
