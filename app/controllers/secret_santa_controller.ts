import env from '#start/env'
import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'

const SESSION_KEY = 'secret_santa_unlocked'
const PAGE_SIZE = 50

type TableSummary = {
  name: string
  rows: number
}

type ColumnSummary = {
  name: string
  type: string
  nullable: boolean
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function safePage(value: unknown): number {
  const parsed = Number(value ?? 1)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1
}

function normalizeRows(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[]

  if (result && typeof result === 'object') {
    const maybeRows = (result as { rows?: unknown }).rows
    if (Array.isArray(maybeRows)) return maybeRows as Record<string, unknown>[]
  }

  return []
}

function serializeCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function getCount(row: Record<string, unknown> | null | undefined): number {
  const total = row?.total ?? row?.count ?? 0
  const parsed = Number(total)
  return Number.isFinite(parsed) ? parsed : 0
}

export default class SecretSantaController {
  async index({ request, response, session }: HttpContext) {
    if (session.get(SESSION_KEY) !== true) {
      return response.type('html').send(this.renderLogin())
    }

    const tables = await this.listTables()
    const requestedTable = String(request.input('table', tables[0]?.name ?? ''))
    const selectedTable = tables.some((table) => table.name === requestedTable)
      ? requestedTable
      : tables[0]?.name
    const page = safePage(request.input('page'))

    const selected = selectedTable
      ? await this.tableDetail(selectedTable, page)
      : {
          name: '',
          columns: [] as ColumnSummary[],
          rows: [] as Record<string, unknown>[],
          page,
          totalRows: 0,
        }

    return response.type('html').send(this.renderDashboard(tables, selected))
  }

  async login({ request, response, session }: HttpContext) {
    const expectedPassword = env.get('SECRET_SANTA_PASSWORD')

    if (!expectedPassword) {
      return response
        .status(503)
        .type('html')
        .send(this.renderLogin('SECRET_SANTA_PASSWORD is not set.'))
    }

    if (request.input('password') !== expectedPassword) {
      return response.status(401).type('html').send(this.renderLogin('Wrong password. Try again.'))
    }

    session.put(SESSION_KEY, true)
    return response.redirect('/secret-santa')
  }

  async logout({ response, session }: HttpContext) {
    session.forget(SESSION_KEY)
    return response.redirect('/secret-santa')
  }

  private async listTables(): Promise<TableSummary[]> {
    const connection = env.get('DB_CONNECTION')
    const result =
      connection === 'pg'
        ? await db.rawQuery(
            `select table_name as name
             from information_schema.tables
             where table_schema = 'public' and table_type = 'BASE TABLE'
             order by table_name asc`
          )
        : await db.rawQuery(
            `select name
             from sqlite_master
             where type = 'table' and name not like 'sqlite_%'
             order by name asc`
          )

    const tableNames = normalizeRows(result)
      .map((row) => String(row.name ?? ''))
      .filter(Boolean)

    const summaries = await Promise.all(
      tableNames.map(async (name) => {
        const row = await db.from(name).count('* as total').first()
        return { name, rows: getCount(row as Record<string, unknown> | null) }
      })
    )

    return summaries
  }

  private async tableDetail(tableName: string, page: number) {
    const offset = (page - 1) * PAGE_SIZE
    const [columns, countRow, rows] = await Promise.all([
      this.listColumns(tableName),
      db.from(tableName).count('* as total').first(),
      db.from(tableName).select('*').limit(PAGE_SIZE).offset(offset),
    ])

    return {
      name: tableName,
      columns,
      rows: rows as Record<string, unknown>[],
      page,
      totalRows: getCount(countRow as Record<string, unknown> | null),
    }
  }

  private async listColumns(tableName: string): Promise<ColumnSummary[]> {
    if (env.get('DB_CONNECTION') === 'pg') {
      const result = await db.rawQuery(
        `select column_name as name, data_type as type, is_nullable as nullable
         from information_schema.columns
         where table_schema = 'public' and table_name = ?
         order by ordinal_position asc`,
        [tableName]
      )

      return normalizeRows(result).map((row) => ({
        name: String(row.name),
        type: String(row.type),
        nullable: String(row.nullable).toUpperCase() === 'YES',
      }))
    }

    const result = await db.rawQuery(`pragma table_info(${JSON.stringify(tableName)})`)
    return normalizeRows(result).map((row) => ({
      name: String(row.name),
      type: String(row.type ?? 'unknown'),
      nullable: Number(row.notnull ?? 0) === 0,
    }))
  }

  private renderLogin(error?: string): string {
    return this.page('Secret Santa', {
      body: `
        <main class="login-shell">
          <section class="login-card">
            <p class="eyebrow">SportyKore Admin</p>
            <h1>Secret Santa</h1>
            <p class="muted">Enter the dashboard password from the server environment.</p>
            ${error ? `<p class="error">${escapeHtml(error)}</p>` : ''}
            <form method="post" action="/secret-santa" class="login-form">
              <label>
                <span>Password</span>
                <input name="password" type="password" autocomplete="current-password" autofocus />
              </label>
              <button type="submit">Unlock dashboard</button>
            </form>
          </section>
        </main>
      `,
    })
  }

  private renderDashboard(
    tables: TableSummary[],
    selected: {
      name: string
      columns: ColumnSummary[]
      rows: Record<string, unknown>[]
      page: number
      totalRows: number
    }
  ): string {
    const totalPages = Math.max(1, Math.ceil(selected.totalRows / PAGE_SIZE))
    const hasPrevious = selected.page > 1
    const hasNext = selected.page < totalPages
    const selectedColumns = selected.columns.map((column) => column.name)

    return this.page('Secret Santa Dashboard', {
      body: `
        <main class="dashboard">
          <aside class="sidebar">
            <div>
              <p class="eyebrow">SportyKore Admin</p>
              <h1>Database</h1>
            </div>
            <nav>
              ${tables
                .map(
                  (table) => `
                    <a class="${table.name === selected.name ? 'active' : ''}" href="/secret-santa?table=${encodeURIComponent(table.name)}">
                      <span>${escapeHtml(table.name)}</span>
                      <strong>${table.rows}</strong>
                    </a>
                  `
                )
                .join('')}
            </nav>
            <form method="post" action="/secret-santa/logout">
              <button class="secondary" type="submit">Lock dashboard</button>
            </form>
          </aside>
          <section class="content">
            <header class="table-header">
              <div>
                <p class="eyebrow">Table</p>
                <h2>${escapeHtml(selected.name || 'No tables found')}</h2>
                <p class="muted">${selected.totalRows} rows · ${selected.columns.length} columns</p>
              </div>
              <div class="pager">
                ${
                  hasPrevious
                    ? `<a href="/secret-santa?table=${encodeURIComponent(selected.name)}&page=${selected.page - 1}">Previous</a>`
                    : '<span>Previous</span>'
                }
                <strong>${selected.page} / ${totalPages}</strong>
                ${
                  hasNext
                    ? `<a href="/secret-santa?table=${encodeURIComponent(selected.name)}&page=${selected.page + 1}">Next</a>`
                    : '<span>Next</span>'
                }
              </div>
            </header>

            <section class="columns">
              ${selected.columns
                .map(
                  (column) => `
                    <span title="${escapeHtml(column.type)}">
                      ${escapeHtml(column.name)}
                      <small>${escapeHtml(column.type)}${column.nullable ? '' : ' · required'}</small>
                    </span>
                  `
                )
                .join('')}
            </section>

            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    ${selectedColumns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${
                    selected.rows.length > 0
                      ? selected.rows
                          .map(
                            (row) => `
                              <tr>
                                ${selectedColumns
                                  .map(
                                    (column) => `<td>${escapeHtml(serializeCell(row[column]))}</td>`
                                  )
                                  .join('')}
                              </tr>
                            `
                          )
                          .join('')
                      : `<tr><td colspan="${Math.max(1, selectedColumns.length)}">No rows in this table.</td></tr>`
                  }
                </tbody>
              </table>
            </div>
          </section>
        </main>
      `,
    })
  }

  private page(title: string, { body }: { body: string }): string {
    return `<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${escapeHtml(title)}</title>
          <style>
            :root {
              color-scheme: dark;
              --bg: #14061f;
              --panel: #1f0d31;
              --panel-2: #2a123f;
              --text: #fff8e7;
              --muted: #c8bad6;
              --accent: #d89500;
              --accent-2: #ffd76a;
              --danger: #ff7777;
              --line: rgba(255, 248, 231, 0.14);
            }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              min-height: 100vh;
              background:
                linear-gradient(135deg, rgba(255,255,255,0.045) 25%, transparent 25%) 0 0 / 18px 18px,
                linear-gradient(135deg, transparent 75%, rgba(255,255,255,0.045) 75%) 0 0 / 18px 18px,
                var(--bg);
              color: var(--text);
              font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }
            a { color: inherit; text-decoration: none; }
            h1, h2, p { margin: 0; }
            button, input { font: inherit; }
            .login-shell {
              min-height: 100vh;
              display: grid;
              place-items: center;
              padding: 24px;
            }
            .login-card {
              width: min(100%, 420px);
              border: 1px solid var(--line);
              border-left: 8px solid var(--accent);
              border-radius: 18px;
              background: rgba(31, 13, 49, 0.96);
              padding: 28px;
              box-shadow: 0 28px 80px rgba(0,0,0,0.35);
            }
            .eyebrow {
              color: var(--accent-2);
              font-size: 12px;
              font-weight: 800;
              letter-spacing: 0.08em;
              text-transform: uppercase;
            }
            .login-card h1, .sidebar h1 {
              margin-top: 8px;
              font-size: clamp(32px, 8vw, 48px);
              line-height: 1;
            }
            .muted { margin-top: 8px; color: var(--muted); }
            .error {
              margin-top: 18px;
              border-radius: 12px;
              background: rgba(255, 119, 119, 0.13);
              color: var(--danger);
              padding: 12px 14px;
              font-weight: 700;
            }
            .login-form { margin-top: 24px; display: grid; gap: 16px; }
            label { display: grid; gap: 8px; color: var(--muted); font-size: 13px; font-weight: 800; }
            input {
              width: 100%;
              border: 1px solid var(--line);
              border-radius: 14px;
              background: #11051b;
              color: var(--text);
              padding: 14px 16px;
              outline: none;
            }
            input:focus { border-color: var(--accent); box-shadow: 0 0 0 4px rgba(216, 149, 0, 0.18); }
            button, .pager a {
              border: 0;
              border-radius: 14px;
              background: var(--accent);
              color: #120719;
              cursor: pointer;
              font-weight: 900;
              padding: 13px 16px;
            }
            .dashboard {
              min-height: 100vh;
              display: grid;
              grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
            }
            .sidebar {
              position: sticky;
              top: 0;
              height: 100vh;
              overflow: auto;
              display: flex;
              flex-direction: column;
              gap: 22px;
              border-right: 1px solid var(--line);
              background: rgba(20, 6, 31, 0.95);
              padding: 24px;
            }
            nav { display: grid; gap: 8px; }
            nav a {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 14px;
              border: 1px solid transparent;
              border-radius: 12px;
              color: var(--muted);
              padding: 11px 12px;
            }
            nav a.active {
              border-color: rgba(216, 149, 0, 0.45);
              background: rgba(216, 149, 0, 0.12);
              color: var(--text);
            }
            nav span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            nav strong {
              border-radius: 999px;
              background: rgba(255,255,255,0.08);
              padding: 3px 8px;
              font-size: 12px;
            }
            .secondary {
              width: 100%;
              margin-top: auto;
              border: 1px solid var(--line);
              background: transparent;
              color: var(--text);
            }
            .content { min-width: 0; padding: 24px; }
            .table-header {
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              gap: 20px;
              margin-bottom: 18px;
            }
            .table-header h2 { margin-top: 4px; font-size: clamp(26px, 4vw, 42px); }
            .pager { display: flex; align-items: center; gap: 10px; color: var(--muted); }
            .pager span {
              border-radius: 14px;
              background: rgba(255,255,255,0.06);
              color: rgba(255,255,255,0.35);
              padding: 13px 16px;
              font-weight: 900;
            }
            .columns {
              display: flex;
              flex-wrap: wrap;
              gap: 8px;
              margin-bottom: 18px;
            }
            .columns span {
              border: 1px solid var(--line);
              border-radius: 999px;
              background: rgba(255,255,255,0.06);
              padding: 8px 12px;
              color: var(--text);
              font-size: 13px;
              font-weight: 800;
            }
            .columns small {
              margin-left: 6px;
              color: var(--muted);
              font-weight: 700;
            }
            .table-wrap {
              overflow: auto;
              border: 1px solid var(--line);
              border-radius: 18px;
              background: rgba(31, 13, 49, 0.85);
              box-shadow: 0 24px 70px rgba(0,0,0,0.24);
            }
            table { width: 100%; border-collapse: collapse; min-width: 760px; }
            th, td {
              max-width: 320px;
              border-bottom: 1px solid var(--line);
              padding: 12px 14px;
              text-align: left;
              vertical-align: top;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            th {
              position: sticky;
              top: 0;
              background: var(--panel-2);
              color: var(--accent-2);
              font-size: 12px;
              text-transform: uppercase;
            }
            td { color: var(--text); font-size: 13px; }
            tr:hover td { background: rgba(255,255,255,0.04); }
            @media (max-width: 860px) {
              .dashboard { grid-template-columns: 1fr; }
              .sidebar { position: relative; height: auto; }
              .table-header { flex-direction: column; }
              .pager { width: 100%; justify-content: space-between; }
            }
          </style>
        </head>
        <body>${body}</body>
      </html>`
  }
}
