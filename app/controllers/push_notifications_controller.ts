import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import PushNotificationService from '#services/push_notification_service'
import {
  leagueNotificationPreferenceParamsValidator,
  registerPushTokenValidator,
  updateLeagueNotificationPreferenceValidator,
} from '#validators/push_notification'

@inject()
export default class PushNotificationsController {
  constructor(private pushNotificationService: PushNotificationService) {}

  async index({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const limit = Number(request.input('limit', 50))
    const result = await this.pushNotificationService.listUserNotifications(user.id, limit)

    return response.ok({ data: result })
  }

  async unreadCount({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const unreadCount = await this.pushNotificationService.unreadCount(user.id)

    return response.ok({ data: { unreadCount } })
  }

  async markRead({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const notification = await this.pushNotificationService.markNotificationRead(
      user.id,
      Number(params.id)
    )
    const unreadCount = await this.pushNotificationService.unreadCount(user.id)

    return response.ok({ data: { notification, unreadCount } })
  }

  async markAllRead({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    await this.pushNotificationService.markAllNotificationsRead(user.id)

    return response.ok({ data: { unreadCount: 0 } })
  }

  async registerToken({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const data = await request.validateUsing(registerPushTokenValidator)
    await this.pushNotificationService.registerToken(user.id, data)

    return response.ok({ message: 'Push token registered' })
  }

  async showLeaguePreference({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { leagueId } = await request.validateUsing(leagueNotificationPreferenceParamsValidator, {
      data: { leagueId: params.leagueId },
    })

    const preference = await this.pushNotificationService.getLeaguePreference(user.id, leagueId)

    return response.ok({ data: { preference } })
  }

  async updateLeaguePreference({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const [{ leagueId }, data] = await Promise.all([
      request.validateUsing(leagueNotificationPreferenceParamsValidator, {
        data: { leagueId: params.leagueId },
      }),
      request.validateUsing(updateLeagueNotificationPreferenceValidator),
    ])

    const preference = await this.pushNotificationService.setLeaguePreference(
      user.id,
      leagueId,
      data.enabled
    )

    return response.ok({ data: { preference } })
  }
}
