export type DefaultFaqRow = {
  id: string
  category: string
  question: string
  answer: string
  tags: string
  relatedLabel: string
  relatedRoute: string
  sortOrder: number
  published: boolean
}

export const defaultFaqRows: DefaultFaqRow[] = [
  {
    id: 'what-is-sportykore',
    category: 'getting-started',
    question: 'What is SportyKore for?',
    answer:
      'SportyKore helps grassroots leagues manage teams, fixtures, live scores, standings, player profiles, and match-day records in one place.',
    tags: 'basics,overview,leagues,players',
    relatedLabel: '',
    relatedRoute: '',
    sortOrder: 10,
    published: true,
  },
  {
    id: 'join-league',
    category: 'getting-started',
    question: 'How do I join a league?',
    answer:
      'Open Join a league from Account settings, paste the code or link from your league admin, and follow the prompts. If you do not have a player profile yet, SportyKore will ask you to create one first.',
    tags: 'join,code,invite,profile',
    relatedLabel: 'Join a league',
    relatedRoute: '/join-league',
    sortOrder: 20,
    published: true,
  },
  {
    id: 'create-player-profile',
    category: 'player-profile',
    question: 'Why should I create a player profile?',
    answer:
      'Your player profile follows you across leagues. It keeps your bio, position, stats, highlights, and awards together so people can understand your football story quickly.',
    tags: 'profile,stats,highlights,awards',
    relatedLabel: 'Open player profile',
    relatedRoute: '/player/me',
    sortOrder: 30,
    published: true,
  },
  {
    id: 'dob-privacy',
    category: 'player-profile',
    question: 'Why does SportyKore ask for my date of birth?',
    answer:
      'It is used to show your age on your profile. The app does not show your date of birth back on the profile screen.',
    tags: 'dob,age,privacy,profile',
    relatedLabel: '',
    relatedRoute: '',
    sortOrder: 40,
    published: true,
  },
  {
    id: 'youtube-highlights',
    category: 'player-profile',
    question: 'How do YouTube highlights work?',
    answer:
      'Paste a YouTube link in your profile. SportyKore checks the link, creates the thumbnail, and lets visitors play the highlight from your profile when supported on their device.',
    tags: 'youtube,highlight,video,profile',
    relatedLabel: '',
    relatedRoute: '',
    sortOrder: 50,
    published: true,
  },
  {
    id: 'private-profile',
    category: 'player-profile',
    question: 'Why can I only see a small version of a profile?',
    answer:
      'Some profiles can be private. When that happens, SportyKore shows a respectful limited view instead of empty sections.',
    tags: 'private,visibility,profile',
    relatedLabel: '',
    relatedRoute: '',
    sortOrder: 60,
    published: true,
  },
  {
    id: 'league-admin-role',
    category: 'league-admin',
    question: 'What can a League admin do?',
    answer:
      'A League admin can manage teams, players, games, venues, standings, invites, knockout rounds, and match-day controls for the league.',
    tags: 'roles,admin,permissions,league',
    relatedLabel: '',
    relatedRoute: '',
    sortOrder: 70,
    published: true,
  },
  {
    id: 'league-setup-order',
    category: 'league-admin',
    question: 'What should I set up first as a League admin?',
    answer:
      'Create teams, invite players, add venues, schedule games, then use Match Center on game day. After results are saved, review standings and tied cohorts.',
    tags: 'setup,teams,venues,games,standings',
    relatedLabel: '',
    relatedRoute: '',
    sortOrder: 80,
    published: true,
  },
  {
    id: 'faceid-manage',
    category: 'account',
    question: 'Why does Manage ask for Face ID or device unlock?',
    answer:
      'Manage includes league controls that can change teams, games, scores, and standings. Device unlock adds a quick local check before showing those controls.',
    tags: 'face id,device unlock,manage,security',
    relatedLabel: '',
    relatedRoute: '',
    sortOrder: 90,
    published: true,
  },
  {
    id: 'team-manager-role',
    category: 'team-manager',
    question: 'What can a Team manager do?',
    answer:
      'A Team manager can set the lineup for their team. League-wide controls, score controls, and admin settings stay limited to League admins.',
    tags: 'roles,team manager,lineups,permissions',
    relatedLabel: '',
    relatedRoute: '',
    sortOrder: 100,
    published: true,
  },
  {
    id: 'set-lineup',
    category: 'team-manager',
    question: 'How do I set a lineup?',
    answer:
      'Open the team from Manage, choose the match, then add starters and substitutes. On match day, the lineup also appears inside Match Center.',
    tags: 'lineup,starters,substitutes,team',
    relatedLabel: '',
    relatedRoute: '',
    sortOrder: 110,
    published: true,
  },
  {
    id: 'match-day-flow',
    category: 'match-center',
    question: 'What is the Match Center flow?',
    answer:
      'Use lineups first, start the clock, log goals and match events as they happen, make substitutions from the lineup tab, choose man of the match, then end the game.',
    tags: 'match center,clock,goals,motm,substitutions',
    relatedLabel: '',
    relatedRoute: '',
    sortOrder: 120,
    published: true,
  },
  {
    id: 'end-game',
    category: 'match-center',
    question: 'What does End the game do?',
    answer:
      'End the game finishes the live match flow and saves the final state so the result can feed the league pages, player records, and standings.',
    tags: 'end game,full time,result,match center',
    relatedLabel: '',
    relatedRoute: '',
    sortOrder: 130,
    published: true,
  },
  {
    id: 'motm',
    category: 'match-center',
    question: 'How do I choose man of the match?',
    answer:
      'Open Match Center, go to Lineup, and choose a player from the active starters or substitutes. One man of the match can be saved for each game.',
    tags: 'motm,awards,lineup,player',
    relatedLabel: '',
    relatedRoute: '',
    sortOrder: 140,
    published: true,
  },
  {
    id: 'standings-update',
    category: 'standings',
    question: 'When do standings update?',
    answer:
      'Standings update from completed match results. If a table looks wrong, check that the match score was saved and that the game is in the right season or group.',
    tags: 'standings,results,games,season',
    relatedLabel: '',
    relatedRoute: '',
    sortOrder: 150,
    published: true,
  },
  {
    id: 'standings-zones',
    category: 'standings',
    question: 'What are standing zones?',
    answer:
      'Standing zones mark positions such as promotion, qualification, or relegation. In grouped leagues, a range like 1 to 2 applies to positions 1 and 2 inside each group.',
    tags: 'zones,promotion,groups,standings',
    relatedLabel: '',
    relatedRoute: '',
    sortOrder: 160,
    published: true,
  },
  {
    id: 'tied-cohorts',
    category: 'standings',
    question: 'What are tied cohorts?',
    answer:
      'Tied cohorts are teams that are level by the table rules. League admins can review them and apply the correct manual order when the rules require it.',
    tags: 'ties,tiebreakers,standings,manual rank',
    relatedLabel: '',
    relatedRoute: '',
    sortOrder: 170,
    published: true,
  },
  {
    id: 'invite-expiry',
    category: 'invites',
    question: 'How long does an invite code last?',
    answer:
      'Team invite codes expire after 7 days. A code can be shared with more than one player until it expires.',
    tags: 'invite,code,expiry,team',
    relatedLabel: '',
    relatedRoute: '',
    sortOrder: 180,
    published: true,
  },
  {
    id: 'invite-profile-required',
    category: 'invites',
    question: 'Why do I need a player profile before joining?',
    answer:
      'A league roster needs a player record to attach to your account. After your profile is created, SportyKore takes you back into the invite flow.',
    tags: 'invite,profile,roster,join',
    relatedLabel: '',
    relatedRoute: '',
    sortOrder: 190,
    published: true,
  },
  {
    id: 'missing-controls',
    category: 'account',
    question: 'Why am I missing a button or admin control?',
    answer:
      'Controls are shown based on your role. If you expected admin access, ask the League admin to confirm your role for that league or team.',
    tags: 'roles,permissions,buttons,controls',
    relatedLabel: '',
    relatedRoute: '',
    sortOrder: 200,
    published: true,
  },
]
