import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'

import CoachProfile from '#models/coach_profile'
import Country from '#models/country'
import PlayerSocialLink from '#models/player_social_link'
import Team from '#models/team'
import TeamAdmin from '#models/team_admin'
import User from '#models/user'
import type { CoachAvailability } from '#types/coach'
import type { PlayerSocialPlatform } from '#types/player'

const SEEDED_COACHES = [
  {
    name: 'Coach Tunde Balogun',
    specialty: 'academy development',
    availability: 'open',
    qualification: 'CAF C Licence, youth development certificate',
  },
  {
    name: 'Coach Ifeoma Eze',
    specialty: 'match preparation',
    availability: 'consulting',
    qualification: 'Performance analysis certificate',
  },
  {
    name: 'Coach Musa Danjuma',
    specialty: 'defensive organisation',
    availability: 'open',
    qualification: 'Grassroots coaching badge',
  },
  {
    name: 'Coach Adaeze Okonkwo',
    specialty: 'player development',
    availability: 'open',
    qualification: 'CAF D Licence, safeguarding trained',
  },
  {
    name: 'Coach Emeka Obi',
    specialty: 'goalkeeper training',
    availability: 'not_open',
    qualification: 'Goalkeeper coaching certificate',
  },
  {
    name: 'Coach Mariam Bello',
    specialty: 'talent identification',
    availability: 'consulting',
    qualification: 'Talent ID and scouting workshop',
  },
  {
    name: 'Coach Chika Mensah',
    specialty: 'attacking patterns',
    availability: 'open',
    qualification: 'CAF C Licence',
  },
  {
    name: 'Coach Seyi Afolayan',
    specialty: 'strength and conditioning',
    availability: 'consulting',
    qualification: 'Sports science diploma',
  },
] as const satisfies ReadonlyArray<{
  name: string
  specialty: string
  availability: CoachAvailability
  qualification: string
}>

export default class CoachHistorySeeder extends BaseSeeder {
  async run() {
    const teams = await Team.query().preload('league').orderBy('id', 'asc')
    if (teams.length === 0) {
      throw new Error('CoachHistorySeeder needs seeded teams first. Run DataSeeder or DemoSeeder.')
    }

    const country = await Country.query().orderBy('id', 'asc').first()
    const coaches = await this.ensureCoachProfiles(country?.id ?? null)

    for (const coach of coaches) {
      const assignmentCount = this.randomInt(2, 4)
      const picks = this.pickRandomTeams(teams, assignmentCount)

      for (const [index, team] of picks.entries()) {
        const active = index === 0 || Math.random() > 0.45
        const assignedAt = DateTime.utc().minus({
          months: this.randomInt(1, 42),
          days: this.randomInt(0, 27),
        })

        await TeamAdmin.updateOrCreate(
          { teamId: team.id, userId: coach.userId },
          {
            leagueId: team.leagueId,
            teamId: team.id,
            userId: coach.userId,
            assignedBy: team.league.userId,
            createdAt: assignedAt,
            removedAt: active ? null : assignedAt.plus({ months: this.randomInt(2, 14) }),
          }
        )
      }
    }

    console.log(
      `CoachHistorySeeder attached ${coaches.length} coaches to random teams across seeded leagues.`
    )
  }

  private async ensureCoachProfiles(countryId: number | null): Promise<CoachProfile[]> {
    const existing = await CoachProfile.query().orderBy('id', 'asc')
    if (existing.length >= SEEDED_COACHES.length) {
      return this.shuffle(existing).slice(0, SEEDED_COACHES.length)
    }

    const coaches: CoachProfile[] = [...existing]

    for (const [index, coachSeed] of SEEDED_COACHES.entries()) {
      if (coaches.length >= SEEDED_COACHES.length) {
        break
      }

      const slug = this.slugFor(coachSeed.name)
      const user = await User.updateOrCreate(
        { email: `${slug}@sportykore.coach.seed` },
        {
          email: `${slug}@sportykore.coach.seed`,
          password: 'kickoff-secret',
          fullName: coachSeed.name,
        }
      )

      const coach = await CoachProfile.updateOrCreate(
        { userId: user.id },
        {
          userId: user.id,
          displayName: coachSeed.name,
          bio: `${coachSeed.name} is a seeded coach focused on ${coachSeed.specialty}.`,
          experience: `${this.randomInt(4, 14)} years coaching league and academy football.`,
          qualifications: coachSeed.qualification,
          philosophy:
            'Simple football, clear feedback, and player growth that shows up on match day.',
          countryId,
          city: index % 2 === 0 ? 'Lagos' : 'Abuja',
          state: index % 2 === 0 ? 'Lagos' : 'FCT',
          availability: coachSeed.availability,
          visibility: 'public',
        }
      )

      await this.ensureCoachSocialLinks(coach)
      coaches.push(coach)
    }

    return coaches
  }

  private async ensureCoachSocialLinks(coach: CoachProfile) {
    const handle = this.slugFor(coach.displayName).replace(/-/g, '.')
    const links = [
      {
        platform: 'instagram',
        url: `https://www.instagram.com/${handle}`,
        handle,
      },
      {
        platform: 'website',
        url: `https://${handle}.sportykore.test`,
        handle: `${handle}.sportykore.test`,
      },
    ] as const satisfies ReadonlyArray<{
      platform: PlayerSocialPlatform
      url: string
      handle: string
    }>

    for (const link of links) {
      await PlayerSocialLink.updateOrCreate(
        { coachProfileId: coach.id, platform: link.platform },
        {
          playerId: null,
          coachProfileId: coach.id,
          platform: link.platform,
          url: link.url,
          handle: link.handle,
        }
      )
    }
  }

  private pickRandomTeams(teams: Team[], count: number): Team[] {
    return this.shuffle(teams).slice(0, Math.min(count, teams.length))
  }

  private shuffle<T>(items: T[]): T[] {
    const out = [...items]
    for (let index = out.length - 1; index > 0; index--) {
      const swapIndex = this.randomInt(0, index)
      const current = out[index]!
      out[index] = out[swapIndex]!
      out[swapIndex] = current
    }
    return out
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  private slugFor(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }
}
