export interface Profile { id: string; display_name: string | null; resolution: string; created_at: string }
export interface Attempt { id: string; user_id: string; started_at: string; ended_at: string | null; slip_count: number }
export interface Protocol { id: string; user_id: string; pillar: 'nutrition' | 'movement' | 'sleep' | 'mind' | 'social'; label: string; detail: string; enabled: boolean; position: number; committed: boolean; is_mandatory: boolean; mandatory_since: string | null; cadence: 'daily' | 'weekly'; is_experimental: boolean; card_group: string | null; created_at: string; retired?: boolean; focus_until?: string | null; paused_on?: string | null }
export interface ProtocolCheck { id: string; user_id: string; protocol_id: string; log_date: string; committed: boolean; held: boolean }
export interface WeightLog { id: string; user_id: string; log_date: string; weight_lb: number }
export interface MealLog { id: string; user_id: string; log_date: string; meal_number: 1 | 2; description: string }
export interface SlipLog { id: string; user_id: string; occurred_at: string; note: string }
export interface WaveLog { id: string; user_id: string; occurred_at: string; duration_min: number }
export interface ExperimentBaselineItem { id: string; label: string }
export interface Experiment { id: string; user_id: string; protocol_id: string; title: string; hypothesis: string | null; start_date: string; end_date: string; duration_days: number; baseline_snapshot: ExperimentBaselineItem[]; status: 'active' | 'done'; verdict: 'keep' | 'another_week' | 'drop' | null; created_at: string }
