import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'

import Country from '#models/country'
import CountryService from '#services/country_service'
import CountryTransformer from '#transformers/country_transformer'
import { transformCountryDetail } from '#transformers/country_detail_transformer'

@inject()
export default class CountriesController {
  constructor(protected countryService: CountryService) {}

  async index({ serialize }: HttpContext) {
    const countries = await Country.query().orderBy('name', 'asc')

    return serialize(CountryTransformer.transform(countries)?.useVariant('forList'))
  }

  async show({ params, serialize }: HttpContext) {
    const detail = await this.countryService.getCountryDetail(params.idOrCode)

    return serialize(transformCountryDetail(detail))
  }
}
