/**
 * League-level tiebreaker presets. Points always rank first.
 *
 * Deferred until discipline data exists: `fair_play`, `drawing_of_lots`.
 */
export const LEAGUE_TIEBREAKERS = [
  'goal_difference_goals_scored',
  'goals_scored_goal_difference',
  'wins_goal_difference_goals_scored',
  'goal_difference_goals_conceded',
  'goal_difference_goals_scored_away_goals',
  'goal_difference_goals_scored_head_to_head',
  'head_to_head_goal_difference_goals_scored',
  'head_to_head_goals_scored_goal_difference',
  'away_goals_scored_goal_difference_goals_scored',
] as const

export type LeagueTiebreaker = (typeof LEAGUE_TIEBREAKERS)[number]

export const DEFAULT_LEAGUE_TIEBREAKER: LeagueTiebreaker = 'goal_difference_goals_scored'

export type TiebreakerCriterion =
  | 'goal_difference'
  | 'goals_scored'
  | 'goals_conceded'
  | 'wins'
  | 'away_goals_scored'
  | 'head_to_head_points'
  | 'head_to_head_goal_difference'
  | 'head_to_head_goals_scored'
  | 'head_to_head_mini_league'

const H2H_CRITERIA: TiebreakerCriterion[] = [
  'head_to_head_points',
  'head_to_head_goal_difference',
  'head_to_head_goals_scored',
]

export const TIEBREAKER_PRESETS: Record<LeagueTiebreaker, TiebreakerCriterion[]> = {
  goal_difference_goals_scored: ['goal_difference', 'goals_scored'],
  goals_scored_goal_difference: ['goals_scored', 'goal_difference'],
  wins_goal_difference_goals_scored: ['wins', 'goal_difference', 'goals_scored'],
  goal_difference_goals_conceded: ['goal_difference', 'goals_conceded'],
  goal_difference_goals_scored_away_goals: [
    'goal_difference',
    'goals_scored',
    'away_goals_scored',
  ],
  goal_difference_goals_scored_head_to_head: [
    'goal_difference',
    'goals_scored',
    'head_to_head_mini_league',
  ],
  head_to_head_goal_difference_goals_scored: [
    'head_to_head_points',
    'head_to_head_goal_difference',
    'head_to_head_goals_scored',
    'goal_difference',
    'goals_scored',
  ],
  head_to_head_goals_scored_goal_difference: [
    'head_to_head_points',
    'head_to_head_goals_scored',
    'head_to_head_goal_difference',
    'goals_scored',
    'goal_difference',
  ],
  away_goals_scored_goal_difference_goals_scored: [
    'away_goals_scored',
    'goal_difference',
    'goals_scored',
  ],
}

export function isH2hCriterion(criterion: TiebreakerCriterion): boolean {
  return H2H_CRITERIA.includes(criterion)
}

export function h2hCriteriaFromPreset(criteria: TiebreakerCriterion[]): TiebreakerCriterion[] {
  const explicit = criteria.filter((criterion) => isH2hCriterion(criterion))
  if (explicit.length > 0) {
    return explicit
  }

  if (criteria.includes('head_to_head_mini_league')) {
    return [...H2H_CRITERIA]
  }

  return []
}
