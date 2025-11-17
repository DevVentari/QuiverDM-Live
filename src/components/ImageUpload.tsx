'use client';

import { useState, useRef, DragEvent } from 'react';
import { Box, Flex, Text, Button, TextField, Separator } from '@radix-ui/themes';
import { Upload, Link as LinkIcon, Loader2, X } from 'lucide-react';

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
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('campaignId', campaignId);

      const response = await fetch('/api/upload/npc-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await response.json();
      onChange(data.url);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
  };

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleUpload(file);
    } else {
      setError('Please drop an image file');
    }
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onChange(urlInput.trim());
      setUrlInput('');
      setError(null);
    }
  };

  const handleClearImage = () => {
    onChange('');
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
            <img
              src={value}
              alt="Preview"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
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
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragActive ? 'var(--violet-9)' : 'var(--gray-7)'}`,
          borderRadius: '8px',
          padding: '24px',
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: dragActive ? 'var(--violet-2)' : 'transparent',
          transition: 'all 0.2s ease',
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <Flex direction="column" align="center" gap="2">
          {isUploading ? (
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

      {error && (
        <Text size="2" color="red">
          {error}
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
