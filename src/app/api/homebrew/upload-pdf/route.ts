import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { storage, getStorageMode } from '@/lib/storage';
import { prisma } from '@/server/db';
import { addPDFProcessingJob } from '@/lib/queue/queue';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const campaignId = formData.get('campaignId') as string | null;

    // Support both old (useLLM) and new (useAIExtraction + useMarkerLLM) fields
    const useAIExtraction = formData.get('useAIExtraction') === 'true' || formData.get('useLLM') === 'true';
    // Enable Marker LLM by default for better formatting (can be disabled with useMarkerLLM=false)
    const useMarkerLLM = formData.get('useMarkerLLM') !== 'false'; // Default TRUE
    const llmProvider = (formData.get('llmProvider') as 'gemini' | 'anthropic' | 'openai') || 'gemini';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'File must be a PDF' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Validate campaign ownership if campaignId provided
    if (campaignId) {
      const campaign = await prisma.campaign.findFirst({
        where: { id: campaignId, userId },
      });

      if (!campaign) {
        return NextResponse.json(
          { error: 'Campaign not found or access denied' },
          { status: 403 }
        );
      }
    }

    // Convert file to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate unique key for R2
    const timestamp = Date.now();
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const r2Key = `homebrew-pdfs/${userId}/${timestamp}-${sanitizedFilename}`;

    const storageType = getStorageMode();
    console.log(`[Upload PDF] Uploading ${file.name} to ${storageType}...`);

    // Upload to storage (R2 or local)
    const storageUrl = await storage.upload(r2Key, buffer, file.type);

    console.log(`[Upload PDF] Upload complete: ${storageUrl}`);

    // Create PDF record in database
    const pdf = await prisma.homebrewPDF.create({
      data: {
        userId,
        campaignId: campaignId || undefined,
        filename: file.name,
        fileSize: file.size,
        mimeType: file.type,
        r2Url: storageUrl,
        useLLM: useAIExtraction, // Keep DB field for backwards compat
        processingStatus: 'pending',
      },
    });

    console.log(`[Upload PDF] Database record created: ${pdf.id}`);
    console.log(`[Upload PDF] Options: useAIExtraction=${useAIExtraction}, useMarkerLLM=${useMarkerLLM}, provider=${llmProvider}`);

    // Queue the PDF for processing with BullMQ
    try {
      await addPDFProcessingJob({
        pdfId: pdf.id,
        userId,
        campaignId: campaignId || '',
        r2Key,
        filename: file.name,
        options: {
          useLLM: useMarkerLLM, // Only use Marker LLM if explicitly requested (expensive vision)
          useAIExtraction, // Whether to extract D&D content (cheap text model)
          llmProvider,
        },
      });

      console.log(`[Upload PDF] Job queued successfully for PDF ${pdf.id}`);
    } catch (queueError) {
      console.error('[Upload PDF] Failed to queue job:', queueError);
      // Don't fail the request - PDF is uploaded, can be retried later
    }

    return NextResponse.json({
      success: true,
      pdf: {
        id: pdf.id,
        filename: pdf.filename,
        fileSize: pdf.fileSize,
        processingStatus: pdf.processingStatus,
        useLLM: pdf.useLLM,
      },
    });
  } catch (error: any) {
    console.error('[Upload PDF] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 500 }
    );
  }
}

// Fire-and-forget processing removed - now using BullMQ job queue
// Processing is handled by the worker in src/lib/queue-worker.ts
