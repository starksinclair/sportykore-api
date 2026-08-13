import { createHash } from 'node:crypto'
import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

import IdempotencyKey from '#models/idempotency_key'

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const KEY_PATTERN = /^[A-Za-z0-9._:-]{8,255}$/
const REPLAYABLE_STATUSES = new Set([200, 201, 202, 204])
const PROCESSING_WAIT_MS = 8_000
const PROCESSING_POLL_MS = 120
const PROCESSING_STALE_MINUTES = 10
const RETENTION_HOURS = 24

type JsonRecord = Record<string, unknown>

export default class IdempotencyMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const method = ctx.request.method().toUpperCase()
    const rawKey = ctx.request.header('Idempotency-Key')?.trim()

    if (!rawKey || !WRITE_METHODS.has(method) || !ctx.request.url().startsWith('/api/')) {
      return next()
    }

    if (!KEY_PATTERN.test(rawKey)) {
      return ctx.response.badRequest({
        message: 'Invalid Idempotency-Key header.',
      })
    }

    const path = ctx.request.url(true)
    const requestHash = this.hashRequest(ctx, method, path)
    const keyHash = this.hashKey(ctx, rawKey, method, path)
    const existing = await IdempotencyKey.query().where('key_hash', keyHash).first()

    const now = DateTime.utc()
    if (existing) {
      if (existing.expiresAt <= now || this.isStaleProcessing(existing, now)) {
        await existing.delete()
      } else {
        return this.replayOrReject(ctx, existing, requestHash)
      }
    }

    let row: IdempotencyKey
    try {
      row = await IdempotencyKey.create({
        keyHash,
        requestHash,
        userId: ctx.auth.user?.id ?? null,
        method,
        path,
        status: 'processing',
        expiresAt: DateTime.utc().plus({ hours: RETENTION_HOURS }),
      })
    } catch {
      const raced = await IdempotencyKey.query().where('key_hash', keyHash).first()
      if (raced) {
        return this.replayOrReject(ctx, raced, requestHash)
      }
      throw new Error('Could not reserve idempotency key.')
    }

    try {
      const output = await next()
      await this.rememberResponse(ctx, row)
      return output
    } catch (error) {
      await row.delete()
      throw error
    }
  }

  private async replayOrReject(ctx: HttpContext, row: IdempotencyKey, requestHash: string) {
    if (row.requestHash !== requestHash) {
      return ctx.response.conflict({
        message: 'This Idempotency-Key was already used for a different request.',
      })
    }

    const completed = row.status === 'completed' ? row : await this.waitForCompletion(row.keyHash)
    if (!completed || completed.status !== 'completed') {
      return ctx.response.status(409).send({
        message: 'A request with this Idempotency-Key is still processing.',
      })
    }

    for (const [key, value] of Object.entries(completed.responseHeaders ?? {})) {
      if (key.toLowerCase() === 'set-cookie' || value === null || value === undefined) continue
      ctx.response.header(key, value as string | number | string[])
    }

    ctx.response.header('Idempotency-Replayed', 'true')
    return ctx.response.status(completed.responseStatus ?? 200).send(completed.responseBody)
  }

  private async waitForCompletion(keyHash: string) {
    const deadline = Date.now() + PROCESSING_WAIT_MS
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, PROCESSING_POLL_MS))
      const row = await IdempotencyKey.query().where('key_hash', keyHash).first()
      if (!row || row.status === 'completed') {
        return row
      }
    }
    return null
  }

  private async rememberResponse(ctx: HttpContext, row: IdempotencyKey) {
    const status = ctx.response.getStatus()
    if (
      !REPLAYABLE_STATUSES.has(status) ||
      ctx.response.hasStream ||
      ctx.response.hasFileToStream
    ) {
      await row.delete()
      return
    }

    const headers = this.cacheableHeaders(ctx.response.getHeaders())
    row.merge({
      status: 'completed',
      responseStatus: status,
      responseBody: ctx.response.getBody() ?? null,
      responseHeaders: headers,
    })
    await row.save()
  }

  private cacheableHeaders(headers: Record<string, unknown>): JsonRecord {
    const result: JsonRecord = {}
    for (const [key, value] of Object.entries(headers)) {
      const normalized = key.toLowerCase()
      if (
        normalized === 'set-cookie' ||
        normalized === 'content-length' ||
        normalized === 'etag' ||
        value === null ||
        value === undefined
      ) {
        continue
      }
      if (typeof value === 'string' || typeof value === 'number' || Array.isArray(value)) {
        result[key] = value
      }
    }
    return result
  }

  private isStaleProcessing(row: IdempotencyKey, now: DateTime): boolean {
    return (
      row.status === 'processing' &&
      row.createdAt.plus({ minutes: PROCESSING_STALE_MINUTES }) <= now
    )
  }

  private hashKey(ctx: HttpContext, key: string, method: string, path: string): string {
    const caller = ctx.auth.user?.id
      ? `user:${ctx.auth.user.id}`
      : `auth:${ctx.request.header('authorization') ?? 'anonymous'}`
    return this.sha256(`${caller}:${method}:${path}:${key}`)
  }

  private hashRequest(ctx: HttpContext, method: string, path: string): string {
    return this.sha256(
      JSON.stringify({
        method,
        path,
        body: ctx.request.body(),
      })
    )
  }

  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex')
  }
}
