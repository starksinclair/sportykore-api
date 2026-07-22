import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'

import AuditService from '#services/audit_service'

@inject()
export default class AuditLogsController {
  constructor(protected auditService: AuditService) {}

  async index({ params, request, serialize }: HttpContext) {
    const page = Number(request.input('page', 1)) || 1
    const perPage = Number(request.input('perPage', 50)) || 50
    const result = await this.auditService.list(Number(params.leagueId), page, perPage)
    return serialize({
      data: result.data.map((row) => ({
        id: row.id,
        leagueId: row.leagueId,
        actorId: row.actorId,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        metadata: row.metadata,
        ipAddress: row.ipAddress,
        createdAt: row.createdAt,
      })),
      meta: result.meta,
    })
  }
}
