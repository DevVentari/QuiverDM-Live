import { router, protectedProcedure } from '../trpc'
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { nanoid } from 'nanoid'
import { IMPORT_SOURCES } from '@/lib/import-adapters/types'
import {
  createImportJob,
  findImportJob,
  listImportJobs,
} from '@/server/repositories/import-job.repository'
import {
  upsertSourceCredential,
  deleteSourceCredential,
  listConnectedSources,
} from '@/server/repositories/source-credential.repository'
import { addImportJob } from '@/lib/queue/import-job-queue'

export const importHubRouter = router({
  startImport: protectedProcedure
    .input(
      z.object({
        source: z.enum(IMPORT_SOURCES),
        params: z.record(z.unknown()),
        campaignId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id
      const jobId = nanoid()

      await createImportJob({
        id: jobId,
        userId,
        campaignId: input.campaignId,
        source: input.source,
        metadata: input.params,
      })

      await addImportJob({
        jobId,
        userId,
        source: input.source,
        campaignId: input.campaignId,
        params: input.params,
      })

      return { jobId }
    }),

  getJobStatus: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input, ctx }) => {
      const job = await findImportJob(input.jobId, ctx.session.user.id)
      if (!job) throw new TRPCError({ code: 'NOT_FOUND', message: 'Import job not found' })
      return {
        status: job.status,
        progress: job.progress,
        total: job.total,
        error: job.error,
      }
    }),

  listJobs: protectedProcedure
    .input(z.object({ source: z.string().optional() }))
    .query(({ input, ctx }) => listImportJobs(ctx.session.user.id, input.source)),

  connectSource: protectedProcedure
    .input(z.object({ source: z.enum(IMPORT_SOURCES), credentials: z.record(z.unknown()) }))
    .mutation(({ input, ctx }) =>
      upsertSourceCredential(ctx.session.user.id, input.source, input.credentials)
    ),

  disconnectSource: protectedProcedure
    .input(z.object({ source: z.enum(IMPORT_SOURCES) }))
    .mutation(({ input, ctx }) =>
      deleteSourceCredential(ctx.session.user.id, input.source)
    ),

  getConnectedSources: protectedProcedure.query(({ ctx }) =>
    listConnectedSources(ctx.session.user.id)
  ),
})

export type ImportHubRouter = typeof importHubRouter
