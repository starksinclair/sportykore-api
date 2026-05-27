import User from '#models/user'
import WelcomeNotification from '#mails/welcome_notification'
import { signupValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'
import mail from '@adonisjs/mail/services/main'

export default class NewAccountController {
  async create({ inertia }: HttpContext) {
    return inertia.render('auth/signup', {})
  }

  async store({ request, response, auth }: HttpContext) {
    const payload = await request.validateUsing(signupValidator)
    const user = await User.create({ ...payload })

    await auth.use('web').login(user)
    await mail.sendLater(new WelcomeNotification(user))
    response.redirect().toRoute('home')
  }
}
