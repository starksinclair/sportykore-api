import env from '#start/env'
import mail from '@adonisjs/mail/services/main'
import { Exception } from '@adonisjs/core/exceptions'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import OtpCode from '#models/otp_code'
import User from '#models/user'
import OtpService from '#services/otp_service'
import {
  isReviewAccountEnabled,
  isReviewerEmail,
  isReviewerOtp,
} from '#services/review_account'
import { withFreshDatabase } from '../helpers/migration.js'

const REVIEW_ADMIN = 'review-admin@sportykore.com'
const REVIEW_PLAYER = 'review-player@sportykore.com'
const REVIEW_CODE = '424242'
const OTHER_EMAIL = 'normal-user@example.com'

function enableReviewAccounts() {
  env.set('REVIEW_ACCOUNT_ENABLED', true)
  env.set('REVIEW_ADMIN_EMAIL', REVIEW_ADMIN)
  env.set('REVIEW_PLAYER_EMAIL', REVIEW_PLAYER)
  env.set('REVIEW_OTP_CODE', REVIEW_CODE)
}

function disableReviewAccounts() {
  env.set('REVIEW_ACCOUNT_ENABLED', false)
}

test.group('review_account helpers', () => {
  test('enabled only when flag and all values are present and code is 6 digits', ({ assert }) => {
    disableReviewAccounts()
    assert.isFalse(isReviewAccountEnabled())

    enableReviewAccounts()
    assert.isTrue(isReviewAccountEnabled())
    assert.isTrue(isReviewerEmail(REVIEW_ADMIN))
    assert.isTrue(isReviewerEmail(REVIEW_PLAYER))
    assert.isFalse(isReviewerEmail(OTHER_EMAIL))
    assert.isFalse(isReviewerEmail('Review-Admin@sportykore.com'))
    assert.isTrue(isReviewerOtp(REVIEW_ADMIN, REVIEW_CODE))
    assert.isFalse(isReviewerOtp(REVIEW_ADMIN, '000000'))
    assert.isFalse(isReviewerOtp(OTHER_EMAIL, REVIEW_CODE))

    env.set('REVIEW_OTP_CODE', '12345')
    assert.isFalse(isReviewAccountEnabled())

    env.set('REVIEW_ACCOUNT_ENABLED', true)
    env.set('REVIEW_ADMIN_EMAIL', '')
    env.set('REVIEW_PLAYER_EMAIL', REVIEW_PLAYER)
    env.set('REVIEW_OTP_CODE', REVIEW_CODE)
    assert.isFalse(isReviewAccountEnabled())
  })
})

test.group('OtpService reviewer bypass', (group) => {
  withFreshDatabase(group)

  let fakeMail: ReturnType<typeof mail.fake>

  group.each.setup(() => {
    enableReviewAccounts()
    fakeMail = mail.fake()
  })

  group.each.teardown(() => {
    disableReviewAccounts()
    mail.restore()
  })

  test('reviewer request returns otp_sent without creating an otp row or sending mail', async ({
    assert,
  }) => {
    await User.create({ email: REVIEW_ADMIN, fullName: 'Review Admin' })
    const service = new OtpService()

    const result = await service.requestOtp(REVIEW_ADMIN)
    assert.equal(result.status, 'otp_sent')

    const codes = await OtpCode.query().where('email', REVIEW_ADMIN)
    assert.lengthOf(codes, 0)
    fakeMail.mails.assertNoneSent()
  })

  test('reviewer + correct code issues user without otp row', async ({ assert }) => {
    const user = await User.create({ email: REVIEW_PLAYER, fullName: 'Review Player' })
    const service = new OtpService()

    await service.requestOtp(REVIEW_PLAYER)
    const { user: verified } = await service.verifyOtp(REVIEW_PLAYER, REVIEW_CODE)

    assert.equal(verified.id, user.id)
    assert.equal(verified.email, REVIEW_PLAYER)
    fakeMail.mails.assertNoneSent()
  })

  test('reviewer + wrong code is rejected', async ({ assert }) => {
    await User.create({ email: REVIEW_ADMIN, fullName: 'Review Admin' })
    const service = new OtpService()

    await assert.rejects(async () => {
      await service.verifyOtp(REVIEW_ADMIN, '999999')
    }, 'Invalid or expired OTP')
  })

  test('non-reviewer cannot use REVIEW_OTP_CODE', async ({ assert }) => {
    await User.create({ email: OTHER_EMAIL, fullName: 'Normal User' })
    const service = new OtpService()

    await assert.rejects(async () => {
      await service.verifyOtp(OTHER_EMAIL, REVIEW_CODE)
    }, 'Invalid or expired OTP')
  })

  test('disabled bypass makes reviewer behave like a normal user', async ({ assert }) => {
    disableReviewAccounts()
    await User.create({ email: REVIEW_ADMIN, fullName: 'Review Admin' })
    const service = new OtpService()

    await assert.rejects(async () => {
      await service.verifyOtp(REVIEW_ADMIN, REVIEW_CODE)
    }, 'Invalid or expired OTP')

    const result = await service.requestOtp(REVIEW_ADMIN)
    assert.equal(result.status, 'otp_sent')
    fakeMail.mails.assertSentCount(1)

    const otp = await OtpCode.query().where('email', REVIEW_ADMIN).where('is_used', false).firstOrFail()
    const { user } = await service.verifyOtp(REVIEW_ADMIN, otp.code)
    assert.equal(user.email, REVIEW_ADMIN)
  })

  test('ordinary OTP flow still works when bypass is enabled', async ({ assert }) => {
    await User.create({ email: OTHER_EMAIL, fullName: 'Normal User' })
    const service = new OtpService()

    const result = await service.requestOtp(OTHER_EMAIL)
    assert.equal(result.status, 'otp_sent')
    fakeMail.mails.assertSentCount(1)

    const otp = await OtpCode.query().where('email', OTHER_EMAIL).where('is_used', false).firstOrFail()
    assert.match(otp.code, /^\d{6}$/)
    assert.isTrue(otp.expiresAt > DateTime.now())

    const { user } = await service.verifyOtp(OTHER_EMAIL, otp.code)
    assert.equal(user.email, OTHER_EMAIL)

    await otp.refresh()
    assert.equal(Boolean(otp.isUsed), true)

    try {
      await service.verifyOtp(OTHER_EMAIL, otp.code)
      assert.fail('expected reused OTP to fail')
    } catch (error) {
      assert.instanceOf(error, Exception)
      assert.equal((error as Exception).status, 401)
    }
  })
})
