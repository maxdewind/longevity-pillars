'use client'

/** Seven dots showing held nights. Neutral: filled = held, outline = not held. */
export default function DayDots({
  startDate,
  windowDays,
  dayHeld,
  today,
}: {
  startDate: string
  windowDays: number
  dayHeld: Record<string, boolean>
  today: string
}) {
  const dates: string[] = []
  const d = new Date(startDate + 'T12:00:00')
  for (let i = 0; i < windowDays; i++) {
    const dt = new Date(d)
    dt.setDate(d.getDate() + i)
    dates.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`)
  }
  return (
    <div className="flex gap-2 mt-4" aria-label="Held nights">
      {dates.map((date) => {
        const held = dayHeld[date] === true
        const isToday = date === today
        return (
          <span
            key={date}
            title={date}
            className="rounded-full"
            style={{
              width: 26,
              height: 26,
              background: held ? '#f0506e' : 'transparent',
              border: `1.5px solid ${held || isToday ? '#f0506e' : '#4a5160'}`,
            }}
          />
        )
      })}
    </div>
  )
}
