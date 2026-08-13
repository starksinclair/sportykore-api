import { randomUUID } from 'node:crypto'

import { DateTime } from 'luxon'
import { Exception } from '@adonisjs/core/exceptions'
import { inject } from '@adonisjs/core'

import GoogleSheetsService, { type SheetRow } from '#services/google_sheets_service'
import { defaultFaqRows } from '#services/default_faqs'
import env from '#start/env'

export type SupportFaqArticle = {
  id: string
  categoryId: string
  question: string
  answer: string
  tags: string[]
  relatedAction?: {
    label: string
    route: string
  }
  sortOrder: number
}

export type BugReportInput = {
  type: string
  title: string
  description: string
  expected?: string
  email?: string
  route?: string
  appVersion?: string
  platform?: string
  osVersion?: string
  deviceModel?: string
}

const FAQ_HEADERS = [
  'id',
  'category',
  'question',
  'answer',
  'tags',
  'related_label',
  'related_route',
  'sort_order',
  'published',
  'updated_at',
]

const BUG_HEADERS = [
  'id',
  'created_at',
  'type',
  'title',
  'description',
  'expected',
  'email',
  'user_id',
  'route',
  'app_version',
  'platform',
  'os_version',
  'device_model',
  'status',
]

@inject()
export default class SupportService {
  constructor(private readonly sheets: GoogleSheetsService) {}

  async listFaqs(): Promise<SupportFaqArticle[]> {
    const spreadsheetId = this.spreadsheetId()
    const sheetName = this.faqSheetName()
    await this.ensureFaqHeader(spreadsheetId, sheetName)

    const values = await this.sheets.getValues(spreadsheetId, sheetName, 'A1:J')
    const rows = this.sheets.rowsToObjects(values)

    return rows
      .filter((row) => this.isPublished(row))
      .map((row, index) => this.toFaqArticle(row, index))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.question.localeCompare(b.question))
  }

  async appendBugReport(input: BugReportInput, userId?: number | null) {
    const spreadsheetId = this.spreadsheetId()
    const sheetName = this.bugsSheetName()
    await this.ensureBugsHeader(spreadsheetId, sheetName)

    const now = DateTime.utc().toISO()
    const id = randomUUID()
    await this.sheets.appendValues(spreadsheetId, sheetName, [
      [
        id,
        now ?? '',
        input.type,
        input.title,
        input.description,
        input.expected ?? '',
        input.email ?? '',
        userId ? String(userId) : '',
        input.route ?? '',
        input.appVersion ?? '',
        input.platform ?? '',
        input.osVersion ?? '',
        input.deviceModel ?? '',
        'new',
      ],
    ])

    return { id, createdAt: now }
  }

  async seedDefaultFaqs() {
    const spreadsheetId = this.spreadsheetId()
    const sheetName = this.faqSheetName()
    await this.ensureFaqHeader(spreadsheetId, sheetName)

    const values = await this.sheets.getValues(spreadsheetId, sheetName, 'A1:J')
    const existingIds = new Set(
      this.sheets
        .rowsToObjects(values)
        .map((row) => row.id?.trim())
        .filter(Boolean)
    )
    const now = DateTime.utc().toISO() ?? ''
    const rows = defaultFaqRows
      .filter((row) => !existingIds.has(row.id))
      .map((row) => [
        row.id,
        row.category,
        row.question,
        row.answer,
        row.tags,
        row.relatedLabel,
        row.relatedRoute,
        String(row.sortOrder),
        row.published ? 'TRUE' : 'FALSE',
        now,
      ])

    if (rows.length) {
      await this.sheets.appendValues(spreadsheetId, sheetName, rows)
    }

    return { inserted: rows.length, skipped: defaultFaqRows.length - rows.length }
  }

  private async ensureFaqHeader(spreadsheetId: string, sheetName: string) {
    await this.sheets.ensureSheet(spreadsheetId, sheetName)
    const values = await this.sheets.getValues(spreadsheetId, sheetName, 'A1:J1')
    if (values[0]?.join('|') === FAQ_HEADERS.join('|')) return
    await this.sheets.updateValues(spreadsheetId, sheetName, 'A1:J1', [FAQ_HEADERS])
  }

  private async ensureBugsHeader(spreadsheetId: string, sheetName: string) {
    await this.sheets.ensureSheet(spreadsheetId, sheetName)
    const values = await this.sheets.getValues(spreadsheetId, sheetName, 'A1:N1')
    if (values[0]?.join('|') === BUG_HEADERS.join('|')) return
    await this.sheets.updateValues(spreadsheetId, sheetName, 'A1:N1', [BUG_HEADERS])
  }

  private toFaqArticle(row: SheetRow, index: number): SupportFaqArticle {
    const relatedLabel = row.related_label?.trim()
    const relatedRoute = row.related_route?.trim()
    return {
      id: row.id?.trim() || `faq-${index + 1}`,
      categoryId: row.category?.trim() || 'getting-started',
      question: row.question?.trim() ?? '',
      answer: row.answer?.trim() ?? '',
      tags: (row.tags ?? '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      relatedAction:
        relatedLabel && relatedRoute
          ? {
              label: relatedLabel,
              route: relatedRoute,
            }
          : undefined,
      sortOrder: Number(row.sort_order ?? index + 1) || index + 1,
    }
  }

  private isPublished(row: SheetRow) {
    const value = (row.published ?? 'TRUE').trim().toLowerCase()
    return value !== 'false' && value !== '0' && value !== 'no'
  }

  private spreadsheetId() {
    const id = env.get('SUPPORT_SHEETS_SPREADSHEET_ID') ?? env.get('GOOGLE_SHEETS_SPREADSHEET_ID')
    if (!id) {
      throw new Exception('Google Sheets spreadsheet ID is not configured', { status: 500 })
    }
    return id
  }

  private faqSheetName() {
    return env.get('SUPPORT_FAQ_SHEET_NAME') ?? env.get('GOOGLE_SHEETS_FAQ_NAME') ?? 'faq'
  }

  private bugsSheetName() {
    return env.get('SUPPORT_BUGS_SHEET_NAME') ?? env.get('GOOGLE_SHEETS_BUGS_NAME') ?? 'bugs'
  }
}
