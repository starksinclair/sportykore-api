import { createSign } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'

import { Exception } from '@adonisjs/core/exceptions'
import env from '#start/env'

type ServiceAccountCredentials = {
  client_email: string
  private_key: string
}

type TokenCache = {
  accessToken: string
  expiresAt: number
}

export type SheetRow = Record<string, string>

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

export default class GoogleSheetsService {
  private tokenCache: TokenCache | null = null

  async getValues(spreadsheetId: string, sheetName: string, range: string) {
    const accessToken = await this.getAccessToken()
    const encodedRange = encodeURIComponent(`${sheetName}!${range}`)
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )

    if (response.status === 404) {
      return []
    }

    if (!response.ok) {
      throw await this.toException(response, 'Could not read Google Sheet')
    }

    const body = (await response.json()) as { values?: string[][] }
    return body.values ?? []
  }

  async appendValues(spreadsheetId: string, sheetName: string, rows: string[][]) {
    await this.ensureSheet(spreadsheetId, sheetName)
    const accessToken = await this.getAccessToken()
    const encodedRange = encodeURIComponent(`${sheetName}!A1`)
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: rows }),
      }
    )

    if (!response.ok) {
      throw await this.toException(response, 'Could not append to Google Sheet')
    }
  }

  async updateValues(spreadsheetId: string, sheetName: string, range: string, rows: string[][]) {
    await this.ensureSheet(spreadsheetId, sheetName)
    const accessToken = await this.getAccessToken()
    const encodedRange = encodeURIComponent(`${sheetName}!${range}`)
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: rows }),
      }
    )

    if (!response.ok) {
      throw await this.toException(response, 'Could not update Google Sheet')
    }
  }

  rowsToObjects(values: string[][]): SheetRow[] {
    const [headers, ...rows] = values
    if (!headers?.length) return []

    return rows
      .map((row) =>
        headers.reduce<SheetRow>((record, header, index) => {
          record[this.normalizeHeader(header)] = row[index] ?? ''
          return record
        }, {})
      )
      .filter((row) => Object.values(row).some((value) => value.trim().length > 0))
  }

  async ensureSheet(spreadsheetId: string, sheetName: string) {
    const accessToken = await this.getAccessToken()
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )

    if (!response.ok) {
      throw await this.toException(response, 'Could not inspect Google Sheet')
    }

    const body = (await response.json()) as { sheets?: { properties?: { title?: string } }[] }
    const exists = body.sheets?.some((sheet) => sheet.properties?.title === sheetName)
    if (exists) return

    const createResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [{ addSheet: { properties: { title: sheetName } } }],
        }),
      }
    )

    if (!createResponse.ok) {
      throw await this.toException(createResponse, 'Could not create Google Sheet tab')
    }
  }

  private async getAccessToken() {
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + 60_000) {
      return this.tokenCache.accessToken
    }

    const credentials = await this.loadCredentials()
    const now = Math.floor(Date.now() / 1000)
    const assertion = this.signJwt(
      {
        alg: 'RS256',
        typ: 'JWT',
      },
      {
        iss: credentials.client_email,
        scope: SHEETS_SCOPE,
        aud: TOKEN_URL,
        iat: now,
        exp: now + 3600,
      },
      credentials.private_key
    )

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    })

    if (!response.ok) {
      throw await this.toException(response, 'Could not authenticate Google Sheets')
    }

    const body = (await response.json()) as { access_token?: string; expires_in?: number }
    if (!body.access_token) {
      throw new Exception('Google Sheets auth did not return an access token', { status: 500 })
    }

    this.tokenCache = {
      accessToken: body.access_token,
      expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
    }
    return body.access_token
  }

  private async loadCredentials(): Promise<ServiceAccountCredentials> {
    const inlineEmail = env.get('SUPPORT_GOOGLE_CLIENT_EMAIL') ?? env.get('GOOGLE_CLIENT_EMAIL')
    const inlinePrivateKey = env.get('SUPPORT_GOOGLE_PRIVATE_KEY') ?? env.get('GOOGLE_PRIVATE_KEY')
    if (inlineEmail && inlinePrivateKey) {
      return {
        client_email: inlineEmail,
        private_key: inlinePrivateKey.replace(/\\n/g, '\n'),
      }
    }

    const rawKey =
      env.get('SUPPORT_GOOGLE_SERVICE_ACCOUNT_KEY') ?? env.get('GOOGLE_SERVICE_ACCOUNT')
    if (rawKey) {
      return this.parseKey(rawKey)
    }

    const path = env.get('GOOGLE_APPLICATION_CREDENTIALS') ?? env.get('GCS_KEY')
    if (path) {
      return this.parseKey(await readFile(this.resolvePath(path), 'utf8'))
    }

    throw new Exception('Google Sheets credentials are not configured', { status: 500 })
  }

  private parseKey(raw: string): ServiceAccountCredentials {
    const maybePath = raw.startsWith('file://') || raw.endsWith('.json')
    if (maybePath) {
      throw new Exception(
        'SUPPORT_GOOGLE_SERVICE_ACCOUNT_KEY must be raw JSON. Use GOOGLE_APPLICATION_CREDENTIALS for a file path.',
        { status: 500 }
      )
    }

    const normalized = this.normalizeServiceAccountJson(raw)

    let parsed: Partial<ServiceAccountCredentials>
    try {
      parsed = JSON.parse(normalized) as Partial<ServiceAccountCredentials>
    } catch {
      throw new Exception(
        'Google service account JSON is invalid. Put the full JSON on one line, or use GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY (private key as a single quoted line with \\n escapes). Multi-line JSON in .env files is truncated by Node --env-file.',
        { status: 500 }
      )
    }

    if (!parsed.client_email || !parsed.private_key) {
      throw new Exception('Google service account key is missing client_email or private_key', {
        status: 500,
      })
    }

    return {
      client_email: parsed.client_email,
      private_key: parsed.private_key.replace(/\\n/g, '\n'),
    }
  }

  /**
   * Env loaders often mangle JSON: wrapping quotes, escaped quotes, or truncating
   * multi-line values to `{`. Normalize common cases before JSON.parse.
   */
  private normalizeServiceAccountJson(raw: string): string {
    let value = raw.trim()
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      value = value.slice(1, -1)
    }
    // Doubly-escaped JSON from some secret managers: {\"type\":\"service_account\"...}
    if (value.includes('\\"') && !value.includes('"type"')) {
      value = value.replace(/\\"/g, '"').replace(/\\\\n/g, '\\n')
    }
    return value
  }

  private resolvePath(path: string) {
    const withoutScheme = path.replace(/^file:\/\//, '')
    return isAbsolute(withoutScheme) ? withoutScheme : resolve(process.cwd(), withoutScheme)
  }

  private signJwt(header: Record<string, unknown>, payload: Record<string, unknown>, key: string) {
    const unsigned = `${this.base64Url(JSON.stringify(header))}.${this.base64Url(JSON.stringify(payload))}`
    const signature = createSign('RSA-SHA256').update(unsigned).sign(key)
    return `${unsigned}.${this.base64Url(signature)}`
  }

  private base64Url(value: string | Buffer) {
    return Buffer.from(value)
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
  }

  private normalizeHeader(header: string) {
    return header.trim().toLowerCase().replace(/\s+/g, '_')
  }

  private async toException(response: Response, fallback: string) {
    let message = fallback
    try {
      const body = (await response.json()) as {
        error?: { message?: string } | string
        error_description?: string
        message?: string
      }
      const googleError = typeof body.error === 'string' ? body.error : body.error?.message
      message = body.error_description ?? googleError ?? body.message ?? fallback
    } catch {
      message = fallback
    }

    return new Exception(message, { status: response.status >= 400 ? response.status : 500 })
  }
}
