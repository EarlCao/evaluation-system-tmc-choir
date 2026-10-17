export interface ReportScale {
  type: "NUMERIC" | "PERCENT";
  min: number;
  max: number;
  step: number;
}

/** One criterion *version*: a scale change makes a new version, so averages never mix scales. */
export interface CriterionAggregate {
  criterion: string;
  criterion_public_id: string;
  version: number;
  scale: ReportScale;
  rated: number;
  not_rated: number;
  suppressed: boolean;
  average: number | null;
  average_percent: number | null;
}

export interface ReportTrendPoint {
  cycle: { public_id: string; name: string };
  evaluations: number;
  evaluators: number;
  suppressed: boolean;
  average_percent: number | null;
}

export interface SectionAggregate {
  id: number;
  name: string;
  evaluations: number;
  recipients: number;
  evaluators: number;
  suppressed: boolean;
  average_percent: number | null;
}

/** GET /api/v1/admin/reports/choir/ (REP-01, REP-03, REP-06). */
export interface ChoirSummary {
  threshold: number;
  totals: { evaluations: number; evaluators: number; recipients: number };
  criteria: CriterionAggregate[];
  voice_sections: SectionAggregate[];
  trend: ReportTrendPoint[];
}

/** GET /api/v1/admin/reports/members/{id}/ (REP-01, REP-02). */
export interface MemberSummary {
  member: {
    public_id: string;
    first_name: string;
    last_name: string;
    voice_section: string | null;
    status: string;
  };
  evaluations_received: number;
  evaluations_given: number;
  criteria: CriterionAggregate[];
  trend: ReportTrendPoint[];
}

export interface ParticipationMember {
  public_id: string;
  first_name: string;
  last_name: string;
  voice_section: string;
  is_evaluable: boolean;
  possible: number;
  given: number;
  received: number;
  percent: number | null;
}

/** GET /api/v1/admin/reports/participation/?cycle= (REP-01, REP-04). */
export interface ParticipationReport {
  cycle: {
    public_id: string;
    name: string;
    status: string;
    evaluation_scope: "ALL" | "SAME_SECTION";
  };
  totals: {
    possible_pairs: number;
    submitted_pairs: number;
    participating_members: number;
    participation_percent: number | null;
  };
  members: ParticipationMember[];
}

export interface ReportFilters {
  cycle?: string;
  submitted_from?: string;
  submitted_to?: string;
  voice_section?: string;
  criterion?: string;
}
