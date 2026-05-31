/**
 * GET /api/admin/render-video/progress/:renderId
 *
 * Polls Remotion Lambda for render progress and syncs the result to the DB.
 * Called every 3 seconds by the VideoEngine frontend until status is
 * "done" or "failed".
 *
 * Response shape:
 *   { status: 'rendering', progress: 0.42 }
 *   { status: 'done',      progress: 1,    outputUrl: 'https://s3...' }
 *   { status: 'failed',    progress: 0,    error: 'message' }
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, tooManyRequests, DEFAULT_LIMIT, DEFAULT_WINDOW_MS } from '@/lib/rate-limit'
import type { AwsRegion } from '@remotion/lambda'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ renderId: string }> },
) {
  // Auth
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Light rate limiting — polls every 3 s so 60/min is generous
  const rl = checkRateLimit(`render-progress:${userId}`, DEFAULT_LIMIT, DEFAULT_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  const { renderId } = await params

  // Load persisted record
  const record = await prisma.videoRender.findUnique({ where: { renderId } })
  if (!record) return NextResponse.json({ error: 'Render not found' }, { status: 404 })

  // If already terminal, return cached result (avoid unnecessary Lambda API calls)
  if (record.status === 'done' || record.status === 'failed') {
    return NextResponse.json({
      status:    record.status,
      progress:  record.progress,
      outputUrl: record.outputUrl ?? undefined,
      error:     record.errorMsg ?? undefined,
    })
  }

  // Poll Lambda for current progress
  try {
    const { getRenderProgress } = await import('@remotion/lambda/client')

    const progress = await getRenderProgress({
      renderId,
      bucketName:   record.bucketName,
      functionName: process.env.REMOTION_AWS_FUNCTION_NAME!,
      region:       record.awsRegion as AwsRegion,
    })

    // Terminal: done
    if (progress.done) {
      const outputUrl = progress.outputFile ?? null
      await prisma.videoRender.update({
        where: { renderId },
        data: {
          status:      'done',
          progress:    1,
          outputUrl,
          completedAt: new Date(),
        },
      })
      return NextResponse.json({ status: 'done', progress: 1, outputUrl })
    }

    // Terminal: Lambda returned a fatal error
    if (progress.fatalErrorEncountered) {
      const errorMsg = progress.errors?.[0]?.message ?? 'Render failed in Lambda'
      await prisma.videoRender.update({
        where: { renderId },
        data: { status: 'failed', errorMsg, completedAt: new Date() },
      })
      return NextResponse.json({ status: 'failed', progress: 0, error: errorMsg })
    }

    // Still in progress — update DB and return current fraction
    const fraction = progress.overallProgress ?? 0
    await prisma.videoRender.update({
      where: { renderId },
      data: { progress: fraction },
    })
    return NextResponse.json({ status: 'rendering', progress: fraction })

  } catch (err) {
    // Lambda API unreachable or credentials bad — don't mark as failed yet,
    // just let the poller retry on the next tick.
    const msg = err instanceof Error ? err.message : 'Progress check failed'
    return NextResponse.json({ status: 'rendering', progress: record.progress, warning: msg })
  }
}
