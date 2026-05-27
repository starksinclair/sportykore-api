import { UserSchema } from '#database/schema'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { hasMany, hasOne, manyToMany } from '@adonisjs/lucid/orm'

import type { HasMany, HasOne, ManyToMany } from '@adonisjs/lucid/types/relations'
import League from '#models/league'
import Team from '#models/team'
import Player from '#models/player'
import Invite from '#models/invite'

export default class User extends compose(UserSchema, withAuthFinder(hash)) {
  static accessTokens = DbAccessTokensProvider.forModel(User, {
    expiresIn: '30 days',
    prefix: 'kpk_',
    table: 'auth_access_tokens',
    type: 'auth_token',
    tokenSecretLength: 40,
  })

  get initials() {
    const [first, last] = this.fullName ? this.fullName.split(' ') : this.email.split('@')
    if (first && last) {
      return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
    }
    return `${first.slice(0, 2)}`.toUpperCase()
  }
  @hasMany(() => League)
  declare leagues: HasMany<typeof League>

  @hasMany(() => Team)
  declare teams: HasMany<typeof Team>

  @hasOne(() => Player, { foreignKey: 'userId' })
  declare player: HasOne<typeof Player>

  @hasMany(() => Player, { foreignKey: 'addedBy' })
  declare addedPlayers: HasMany<typeof Player>

  @hasMany(() => Invite)
  declare invites: HasMany<typeof Invite>

  @manyToMany(() => League, {
    pivotTable: 'favourite_leagues',
    pivotTimestamps: { createdAt: true, updatedAt: false },
  })
  declare favoriteLeagues: ManyToMany<typeof League>
}
