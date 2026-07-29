/**
 * Admin options-signal management — PATCH (toggle/edit) and DELETE.
 *
 * No POST: an options signal's value is its REAL chain data (optionSymbol,
 * bid/ask, OI, greeks) pulled live from Schwab at generation time. Hand-
 * creating one would mean inventing those fields, which is exactly the kind
 * of fabricated market data this codebase avoids everywhere else. Editing
 * an existing one flags isManual so it leaves the published track record.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, logAdminAction } from '@/lib/adminAuth'
import { checkRateLimit, tooManyRequests, ADMIN_LIMIT, ADMIN_WINDOW_MS } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : null
}

export async function PATCH(req: Request) {
  const adminId = await requireAdmin()
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rl = checkRateLimit(`admin-options-edit:${adminId}`, ADMIN_LIMIT, ADMIN_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  let body: { id?: unknown; isActive?: unknown; confidence?: unknown; riskLevel?: unknown; summary?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const id = typeof body.id === 'string' ? body.id : ''
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const data: Record<string, unknown> = {}
  if (body.confidence !== undefined) {
    const c = num(body.confidence)
    if (c === null || c < 0 || c > 100) return NextResponse.json({ error: 'Confidence must be 0-100' }, { status: 400 })
    data.confidence = c
  }
  if (body.riskLevel !== undefined) {
    const r = typeof body.riskLevel === 'string' ? body.riskLevel : ''
    if (!['Low', 'Medium', 'High'].includes(r)) return NextResponse.json({ error: 'Invalid risk level' }, { status: 400 })
    data.riskLevel = r
  }
  if (body.summary !== undefined) data.summary = typeof body.summary === 'string' ? body.summary.trim() : ''
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)

  if (Object.keys(data).length === 0) return NextResponse.json({ error: 'No editable fields supplied' }, { status: 400 })

  const isToggleOnly = Object.keys(data).length === 1 && 'isActive' in data
  if (!isToggleOnly) data.isManual = true

  try {
    const sig = await prisma.optionsSignal.update({ where: { id }, data })
    await logAdminAction({
      adminId,
      action: isToggleOnly ? 'options.toggle' : 'options.edit',
      target: sig.ticker,
      detail: isToggleOnly ? `isActive -> ${sig.isActive}` : `edited ${Object.keys(data).filter((k) => k !== 'isManual').join(', ')}; flagged manual`,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[admin/options-signal] update failed', e)
    return NextResponse.json({ error: 'Failed to update options signal' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const adminId = await requireAdmin()
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rl = checkRateLimit(`admin-options-delete:${adminId}`, ADMIN_LIMIT, ADMIN_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  try {
    const sig = await prisma.optionsSignal.delete({ where: { id } })
    await logAdminAction({ adminId, action: 'options.delete', target: sig.ticker, detail: `deleted ${sig.contractType} ${sig.ticker} ${sig.strikePrice}` })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[admin/options-signal] delete failed', e)
    return NextResponse.json({ error: 'Failed to delete options signal' }, { status: 500 })
  }
}
