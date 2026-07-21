import AdminAuditLog from '#models/admin_audit_log'

export type AuditLogInput = {
  leagueId: number
  actorId?: number | null
  action: string
  entityType: string
  entityId?: number | null
  metadata?: Record<string, unknown>
  ipAddress?: string | null
}

export default class AuditService {
  async log(input: AuditLogInput): Promise<AdminAuditLog> {
    return AdminAuditLog.create({
      leagueId: input.leagueId,
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? {},
      ipAddress: input.ipAddress ?? null,
    })
  }

  async list(leagueId: number, page = 1, perPage = 50) {
    const safePage = Math.max(1, page)
    const safePerPage = Math.min(100, Math.max(1, perPage))
    const offset = (safePage - 1) * safePerPage

    const [rows, totalRow] = await Promise.all([
      AdminAuditLog.query()
        .where('league_id', leagueId)
        .orderBy('created_at', 'desc')
        .orderBy('id', 'desc')
        .offset(offset)
        .limit(safePerPage),
      AdminAuditLog.query().where('league_id', leagueId).count('* as total').first(),
    ])

    const total = Number((totalRow as unknown as { $extras: { total: number } })?.$extras?.total ?? 0)

    return {
      data: rows,
      meta: {
        total,
        page: safePage,
        perPage: safePerPage,
        lastPage: Math.max(1, Math.ceil(total / safePerPage)),
      },
    }
  }
}
