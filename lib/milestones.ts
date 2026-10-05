export interface Milestone { id: number; hours: number; title: string; bodyState: string; proposed?: boolean }
export const MILESTONES: Milestone[] = [
  { id: 1, hours: 4, title: 'First craving wave peaks and passes', bodyState: 'Craving circuitry at its loudest. This is signals and habit cues, not character. Metabolically, nothing has changed yet.' },
  { id: 2, hours: 8, title: 'The evening wave', bodyState: 'Second major wave, often the hardest of day one. Your body still has fuel available. Waves peak and pass.', proposed: true },
  { id: 3, hours: 24, title: 'Day one complete', bodyState: 'First full day. The scale may dip from water bound to glycogen. That is water, not fat.', proposed: true },
  { id: 4, hours: 72, title: 'Through the wall', bodyState: 'The classic wall. Novelty is gone and waves persist. The win today is the streak itself.', proposed: true },
  { id: 5, hours: 168, title: 'One full week', bodyState: 'The first real metabolic shift begins. Insulin sensitivity starts improving as the constant sugar load lifts.', proposed: true },
  { id: 6, hours: 336, title: 'Two weeks steady', bodyState: 'Waves are fewer and shorter for most people. The plan is becoming something you repeat, not restart.', proposed: true },
  { id: 7, hours: 504, title: 'Three weeks in', bodyState: 'The new pattern is becoming the default. Cravings arrive as echoes now, not commands.', proposed: true },
  { id: 8, hours: 720, title: 'One month', bodyState: 'HbA1c is beginning to reflect the new pattern. It is a 3-month average, so this is the turn starting, not the destination.', proposed: true },
  { id: 9, hours: 1440, title: 'Two months', bodyState: 'Two thirds of the HbA1c window is now clean eating. Clothes usually tell the story before the scale does.', proposed: true },
  { id: 10, hours: 2160, title: 'One full quarter', bodyState: 'HbA1c now substantially reflects the clean pattern. The acute craving era is over. The work is maintenance.', proposed: true },
  { id: 11, hours: 2880, title: 'Four months', bodyState: 'Deep maintenance territory. Markers largely reflect the new normal. Change is slow, quiet and real.', proposed: true },
  { id: 12, hours: 4320, title: 'Half a year', bodyState: 'Hour 4 and month 6 were never the same animal. This milestone is the proof.', proposed: true },
]
export interface JourneyState { currentIndex: number; completedCount: number; progressPct: number; msRemaining: number }
export function getJourneyState(startedAt: Date, now: Date): JourneyState {
  const elapsedMs = Math.max(0, now.getTime() - startedAt.getTime())
  const elapsedHours = elapsedMs / 3600000
  let upcoming = 0
  while (upcoming < MILESTONES.length && elapsedHours >= MILESTONES[upcoming].hours) upcoming++
  const completedCount = upcoming
  const currentIndex = Math.min(upcoming, MILESTONES.length - 1)
  const current = MILESTONES[currentIndex]
  const prevHours = currentIndex === 0 ? 0 : MILESTONES[currentIndex - 1].hours
  const span = Math.max(1, current.hours - prevHours)
  const progressPct = completedCount >= MILESTONES.length ? 100 : Math.min(99, Math.max(0, ((elapsedHours - prevHours) / span) * 100))
  const msRemaining = completedCount >= MILESTONES.length ? 0 : Math.max(0, (current.hours - elapsedHours) * 3600000)
  return { currentIndex, completedCount, progressPct, msRemaining }
}
