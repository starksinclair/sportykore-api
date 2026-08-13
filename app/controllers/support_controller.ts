import type { HttpContext } from '@adonisjs/core/http'
import { Exception } from '@adonisjs/core/exceptions'
import { inject } from '@adonisjs/core'
import app from '@adonisjs/core/services/app'

import SupportService from '#services/support_service'
import { bugReportValidator } from '#validators/support'
import env from '#start/env'

@inject()
export default class SupportController {
  constructor(private readonly support: SupportService) {}

  async faqs({ serialize }: HttpContext) {
    const articles = await this.support.listFaqs()
    return serialize({ articles })
  }

  async bugReport({ auth, request, response }: HttpContext) {
    const data = await request.validateUsing(bugReportValidator)
    const result = await this.support.appendBugReport(
      {
        type: data.type ?? 'bug',
        title: data.title,
        description: data.description,
        expected: data.expected,
        email: data.email ?? auth.user?.email ?? undefined,
        route: data.route,
        appVersion: data.appVersion,
        platform: data.platform,
        osVersion: data.osVersion,
        deviceModel: data.deviceModel,
      },
      auth.user?.id
    )

    return response.created({ message: 'Bug report received', report: result })
  }

  async seedFaqs({ request, response }: HttpContext) {
    const token = env.get('SUPPORT_SEED_TOKEN')
    if (app.inProduction && (!token || request.header('x-support-seed-token') !== token)) {
      throw new Exception('Not allowed to seed FAQs', { status: 403 })
    }

    const result = await this.support.seedDefaultFaqs()
    return response.ok({ message: 'FAQ seed complete', ...result })
  }
}
