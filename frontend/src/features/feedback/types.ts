/** GET /feedback/received/ item. Anonymous by construction: no evaluator fields exist. */
export interface FeedbackItem {
  feedback_id: string;
  cycle: { public_id: string; name: string };
  date: string; // YYYY-MM-DD (day precision only)
  is_edited: boolean;
  comment: string;
  suggestion: string;
  comments?: { key: string; label: string; body: string }[];
}

export interface CriterionSummary {
  criterion: string;
  criterion_public_id: string;
  scale: { type: "NUMERIC" | "PERCENT"; min: number; max: number; step: number };
  n: number;
  suppressed: boolean;
  average: number | null;
  distribution: Record<string, number> | null;
}

export interface TrendPoint {
  cycle: { public_id: string; name: string };
  evaluations: number;
  suppressed: boolean;
  average_percent: number | null;
}

export interface FeedbackSummary {
  evaluations_received: number;
  threshold: number;
  criteria: CriterionSummary[];
  trend: TrendPoint[];
}

export interface FeedbackFilters {
  cycle?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
}
