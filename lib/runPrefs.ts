// Per-device run preferences set on the "Experiment started" screen.
const KEY = 'lp_run_prefs'

export interface RunPrefs {
  morningCommitment: boolean
  eveningCheckin: boolean
}

export function loadRunPrefs(): RunPrefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const p = JSON.parse(raw)
      return {
        morningCommitment: p.morningCommitment !== false,
        eveningCheckin: p.eveningCheckin !== false,
      }
    }
  } catch {
    /* defaults */
  }
  return { morningCommitment: true, eveningCheckin: true }
}

export function saveRunPrefs(p: RunPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}
