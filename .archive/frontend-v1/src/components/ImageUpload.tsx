'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { Box, Flex, Text, Button, TextField } from '@radix-ui/themes';
import { Upload, Link as LinkIcon, Loader2, X } from 'lucide-react';
import { useFileUpload } from '@/hooks/useFileUpload';

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  campaignId: string;
  placeholder?: string;
  previewHeight?: string;
}

export default function ImageUpload({
  value,
  onChange,
  campaignId,
  placeholder = 'Upload or paste image URL',
  previewHeight = '200px',
}: ImageUploadProps) {
  const [urlInput, setUrlInput] = useState('');

  const formData = useMemo(() => ({ campaignId }), [campaignId]);

  const upload = useFileUpload({
    endpoint: '/api/upload/npc-image',
    accept: 'image/*',
    maxSize: 5 * 1024 * 1024, // 5MB
    formData,
    onSuccess: (data) => {
      onChange(data.url);
      upload.clearFile();
    },
    onFileSelect: (file) => {
      // Auto-upload when file is selected
      setTimeout(() => upload.upload(), 0);
    },
  });

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onChange(urlInput.trim());
      setUrlInput('');
    }
  };

  const handleClearImage = () => {
    onChange('');
    upload.clearFile();
  };

  return (
    <Flex direction="column" gap="3">
      {/* Image Preview */}
      <Box
        style={{
          position: 'relative',
          height: previewHeight,
          backgroundColor: 'var(--gray-5)',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        {value ? (
          <>
            <Image
              src={value}
              alt="Preview"
              layout="fill"
              objectFit="cover"
            />
            <Button
              size="1"
              variant="soft"
              color="red"
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
              }}
              onClick={handleClearImage}
            >
              <X size={14} />
              Remove
            </Button>
          </>
        ) : (
          <Flex
            align="center"
            justify="center"
            style={{ height: '100%' }}
          >
            <Text size="2" color="gray">
              No image
            </Text>
          </Flex>
        )}
      </Box>

      {/* Drop Zone for File Upload */}
      <Box
        {...upload.getRootProps()}
        style={{
          border: `2px dashed ${upload.isDragActive ? 'var(--violet-9)' : 'var(--gray-7)'}`,
          borderRadius: '8px',
          padding: '24px',
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: upload.isDragActive ? 'var(--violet-2)' : 'transparent',
          transition: 'all 0.2s ease',
        }}
      >
        <input {...upload.getInputProps()} />
        <Flex direction="column" align="center" gap="2">
          {upload.isUploading ? (
            <>
              <Loader2 size={32} className="animate-spin text-violet-500" />
              <Text size="2" color="gray">
                Uploading...
              </Text>
            </>
          ) : (
            <>
              <Upload size={32} style={{ color: 'var(--gray-9)' }} />
              <Text size="2" weight="medium">
                Drop image here or click to browse
              </Text>
              <Text size="1" color="gray">
                PNG, JPG, WebP, GIF • Max 5MB
              </Text>
            </>
          )}
        </Flex>
      </Box>

      {upload.error && (
        <Text size="2" color="red">
          {upload.error}
        </Text>
      )}

      <Flex align="center" gap="3">
        <Box style={{ flex: 1, height: '1px', backgroundColor: 'var(--gray-6)' }} />
        <Text size="1" color="gray">
          OR
        </Text>
        <Box style={{ flex: 1, height: '1px', backgroundColor: 'var(--gray-6)' }} />
      </Flex>

      {/* URL Input */}
      <Flex direction="column" gap="2">
        <Flex gap="2">
          <TextField.Root
            placeholder="https://example.com/image.jpg"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleUrlSubmit();
              }
            }}
            style={{ flex: 1 }}
          >
            <TextField.Slot>
              <LinkIcon size={16} />
            </TextField.Slot>
          </TextField.Root>
          <Button onClick={handleUrlSubmit} disabled={!urlInput.trim()}>
            Set URL
          </Button>
        </Flex>
        <Text size="1" color="gray">
          Paste a direct link to an image
        </Text>
      </Flex>
    </Flex>
  );
}
