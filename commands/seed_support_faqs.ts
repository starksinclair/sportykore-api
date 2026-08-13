import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

import GoogleSheetsService from '#services/google_sheets_service'
import SupportService from '#services/support_service'

export default class SeedSupportFaqs extends BaseCommand {
  static commandName = 'support:seed-faqs'
  static description = 'Append bundled help center FAQs to the configured Google Sheet'
  static options: CommandOptions = {
    startApp: false,
  }

  async run() {
    const support = new SupportService(new GoogleSheetsService())
    const result = await support.seedDefaultFaqs()

    this.logger.success(
      `FAQ seed complete. Inserted ${result.inserted} row(s), skipped ${result.skipped} existing row(s).`
    )
  }
}
