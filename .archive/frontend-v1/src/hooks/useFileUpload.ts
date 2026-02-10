/**
 * useFileUpload Hook
 *
 * A reusable hook for handling file uploads with:
 * - Drag and drop support
 * - Progress tracking
 * - File validation
 * - Error handling
 *
 * Usage:
 *   const upload = useFileUpload({
 *     endpoint: '/api/upload',
 *     accept: '.pdf',
 *     maxSize: 50 * 1024 * 1024,
 *     onSuccess: (result) => console.log('Uploaded:', result),
 *   });
 *
 *   <div {...upload.getRootProps()}>
 *     <input {...upload.getInputProps()} />
 *     {upload.file && <span>{upload.file.name}</span>}
 *   </div>
 *   <button onClick={upload.upload} disabled={!upload.file || upload.isUploading}>
 *     Upload
 *   </button>
 */

import { useState, useCallback, useRef, useMemo } from 'react';

// =============================================================================
// Types
// =============================================================================

export interface UseFileUploadOptions {
  /** API endpoint for upload */
  endpoint: string;
  /** Accepted file types (e.g., '.pdf', 'image/*', 'video/*,audio/*') */
  accept?: string;
  /** Maximum file size in bytes */
  maxSize?: number;
  /** Additional form data to send with the upload */
  formData?: Record<string, string>;
  /** Callback when upload succeeds */
  onSuccess?: (result: any) => void;
  /** Callback when upload fails */
  onError?: (error: Error) => void;
  /** Callback for upload progress */
  onProgress?: (percent: number) => void;
  /** Callback when file is selected */
  onFileSelect?: (file: File) => void;
  /** Custom validation function */
  validate?: (file: File) => string | null;
}

export interface UseFileUploadResult {
  /** Currently selected file */
  file: File | null;
  /** Whether a file is currently being uploaded */
  isUploading: boolean;
  /** Upload progress (0-100) */
  progress: number;
  /** Error message if any */
  error: string | null;
  /** Whether drag is active over the drop zone */
  isDragActive: boolean;
  /** Select a file programmatically */
  selectFile: (file: File) => void;
  /** Clear the selected file */
  clearFile: () => void;
  /** Trigger the upload */
  upload: (fileOverride?: File) => Promise<any>;
  /** Reset the entire state */
  reset: () => void;
  /** Get props for the drop zone container */
  getRootProps: () => {
    onDragEnter: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    onClick: () => void;
  };
  /** Get props for the hidden file input */
  getInputProps: () => {
    ref: React.RefObject<HTMLInputElement>;
    type: 'file';
    accept?: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    style: React.CSSProperties;
  };
  /** Open file picker dialog */
  openFilePicker: () => void;
}

// =============================================================================
// Default Values
// =============================================================================

const DEFAULT_MAX_SIZE = 100 * 1024 * 1024; // 100MB

// =============================================================================
// Hook Implementation
// =============================================================================

export function useFileUpload(options: UseFileUploadOptions): UseFileUploadResult {
  const {
    endpoint,
    accept,
    maxSize = DEFAULT_MAX_SIZE,
    formData: extraFormData,
    onSuccess,
    onError,
    onProgress,
    onFileSelect,
    validate,
  } = options;

  // State
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  // File validation
  const validateFile = useCallback(
    (selectedFile: File): string | null => {
      // Size check
      if (selectedFile.size > maxSize) {
        const maxSizeMB = Math.round(maxSize / (1024 * 1024));
        return `File size exceeds ${maxSizeMB}MB maximum`;
      }

      // Type check (if accept is specified)
      if (accept) {
        const acceptedTypes = accept.split(',').map((t) => t.trim());
        const fileType = selectedFile.type;
        const fileExt = '.' + selectedFile.name.split('.').pop()?.toLowerCase();

        const isAccepted = acceptedTypes.some((accepted) => {
          if (accepted.startsWith('.')) {
            return fileExt === accepted.toLowerCase();
          }
          if (accepted.endsWith('/*')) {
            return fileType.startsWith(accepted.replace('/*', '/'));
          }
          return fileType === accepted;
        });

        if (!isAccepted) {
          return 'File type not accepted';
        }
      }

      // Custom validation
      if (validate) {
        return validate(selectedFile);
      }

      return null;
    },
    [accept, maxSize, validate]
  );

  // Handle file selection
  const selectFile = useCallback(
    (selectedFile: File) => {
      const validationError = validateFile(selectedFile);
      if (validationError) {
        setError(validationError);
        return;
      }

      setFile(selectedFile);
      setError(null);
      onFileSelect?.(selectedFile);
    },
    [validateFile, onFileSelect]
  );

  // Clear file
  const clearFile = useCallback(() => {
    setFile(null);
    setError(null);
    setProgress(0);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, []);

  // Reset all state
  const reset = useCallback(() => {
    clearFile();
    setIsUploading(false);
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
  }, [clearFile]);

  // Upload file
  const upload = useCallback(async (fileOverride?: File): Promise<any> => {
    const selectedFile = fileOverride ?? file;
    if (!selectedFile) {
      throw new Error('No file selected');
    }

    if (fileOverride) {
      const validationError = validateFile(selectedFile);
      if (validationError) {
        setError(validationError);
        throw new Error(validationError);
      }
      setFile(selectedFile);
    }

    setIsUploading(true);
    setError(null);
    setProgress(0);

    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', selectedFile);

      // Add extra form data
      if (extraFormData) {
        Object.entries(extraFormData).forEach(([key, value]) => {
          formData.append(key, value);
        });
      }

      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;

      // Progress handler
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          setProgress(percent);
          onProgress?.(percent);
        }
      });

      // Load handler
      xhr.addEventListener('load', () => {
        setIsUploading(false);
        xhrRef.current = null;

        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText);
            onSuccess?.(result);
            resolve(result);
          } catch {
            const result = xhr.responseText;
            onSuccess?.(result);
            resolve(result);
          }
        } else {
          let errorMessage = 'Upload failed';
          try {
            const errorData = JSON.parse(xhr.responseText);
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch {
            // Use default error message
          }
          const error = new Error(errorMessage);
          setError(errorMessage);
          onError?.(error);
          reject(error);
        }
      });

      // Error handler
      xhr.addEventListener('error', () => {
        setIsUploading(false);
        xhrRef.current = null;
        const error = new Error('Upload failed');
        setError('Upload failed');
        onError?.(error);
        reject(error);
      });

      // Abort handler
      xhr.addEventListener('abort', () => {
        setIsUploading(false);
        xhrRef.current = null;
        const error = new Error('Upload cancelled');
        reject(error);
      });

      xhr.open('POST', endpoint);
      xhr.send(formData);
    });
  }, [file, endpoint, extraFormData, onSuccess, onError, onProgress, validateFile]);

  // Drag and drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      handleDrag(e);
      setIsDragActive(true);
    },
    [handleDrag]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      handleDrag(e);
      setIsDragActive(false);
    },
    [handleDrag]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      handleDrag(e);
      setIsDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        selectFile(e.dataTransfer.files[0]);
      }
    },
    [handleDrag, selectFile]
  );

  // Input change handler
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        selectFile(e.target.files[0]);
      }
    },
    [selectFile]
  );

  // Open file picker
  const openFilePicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  // Get root props
  const getRootProps = useMemo(
    () => () => ({
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDragOver: handleDrag,
      onDrop: handleDrop,
      onClick: openFilePicker,
    }),
    [handleDragEnter, handleDragLeave, handleDrag, handleDrop, openFilePicker]
  );

  // Get input props
  const getInputProps = useMemo(
    () => () => ({
      ref: inputRef,
      type: 'file' as const,
      accept,
      onChange: handleInputChange,
      style: { display: 'none' } as React.CSSProperties,
    }),
    [accept, handleInputChange]
  );

  return {
    file,
    isUploading,
    progress,
    error,
    isDragActive,
    selectFile,
    clearFile,
    upload,
    reset,
    getRootProps,
    getInputProps,
    openFilePicker,
  };
}
