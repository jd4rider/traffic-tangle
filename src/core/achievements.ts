import type { Progress } from './saves'

export interface AchievementDefinition {
  id: string
  name: string
  description: string
  icon: string
  check: (progress: Progress) => boolean
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'first_commute',
    name: 'First Commute',
    description: 'Get every car home for the first time.',
    icon: 'car',
    check: (progress) => progress.stats.levels >= 1,
  },
  {
    id: 'route_rookie',
    name: 'Route Rookie',
    description: 'Complete five levels.',
    icon: 'route',
    check: (progress) => progress.stats.levels >= 5,
  },
  {
    id: 'traffic_tamer',
    name: 'Traffic Tamer',
    description: 'Complete twenty-five levels.',
    icon: 'signals',
    check: (progress) => progress.stats.levels >= 25,
  },
  {
    id: 'perfect_intersection',
    name: 'Perfect Intersection',
    description: 'Earn three stars on a level.',
    icon: 'star',
    check: (progress) => Object.values(progress.completed).some((record) => record.stars >= 3),
  },
  {
    id: 'green_light_genius',
    name: 'Green Light Genius',
    description: 'Earn three stars on ten levels.',
    icon: 'light',
    check: (progress) => progress.stats.threeStars >= 10,
  },
  {
    id: 'no_collisions',
    name: 'No Collisions',
    description: 'Finish twenty levels without a hint.',
    icon: 'shield',
    check: (progress) => progress.stats.levels >= 20 && progress.stats.hints < 5,
  },
  {
    id: 'hundred_levels',
    name: '100 Levels Complete',
    description: 'Clear one hundred Journey levels.',
    icon: 'medal',
    check: (progress) => Object.keys(progress.completed).length >= 100,
  },
  {
    id: 'five_hundred_levels',
    name: '500 Levels Complete',
    description: 'Clear five hundred Journey levels.',
    icon: 'medal',
    check: (progress) => Object.keys(progress.completed).length >= 500,
  },
  {
    id: 'thousand_levels',
    name: '1,000 Levels Complete',
    description: 'Clear the entire campaign.',
    icon: 'crown',
    check: (progress) => Object.keys(progress.completed).length >= 1000,
  },
  {
    id: 'endless_100',
    name: 'Endless 100',
    description: 'Reach stage 100 in Endless.',
    icon: 'loop',
    check: (progress) => progress.endless.best >= 100,
  },
  {
    id: 'daily_driver',
    name: 'Daily Driver',
    description: 'Finish a Daily Challenge.',
    icon: 'calendar',
    check: (progress) => progress.stats.dailyPlayed >= 1,
  },
  {
    id: 'master_dispatcher',
    name: 'Master Dispatcher',
    description: 'Complete 300 levels and earn 600 stars.',
    icon: 'master',
    check: (progress) => Object.keys(progress.completed).length >= 300 && progress.stats.threeStars >= 200,
  },
]

export function achievementById(id: string): AchievementDefinition | undefined {
  return ACHIEVEMENTS.find((achievement) => achievement.id === id)
}

export function evaluateAchievements(progress: Progress): string[] {
  const unlocked: string[] = []
  for (const achievement of ACHIEVEMENTS) {
    if (progress.achievements.includes(achievement.id)) continue
    if (!achievement.check(progress)) continue
    progress.achievements.push(achievement.id)
    unlocked.push(achievement.id)
  }
  return unlocked
}
