import type { VoiceSection } from "@/features/auth";

export interface PublicSelfEvaluationRating {
  criterion_version: number;
  criterion_name: string;
  value: number | null;
  label: string;
  min_value: number;
  max_value: number;
}

export interface PublicSelfEvaluationComment {
  key: string;
  label: string;
  body: string;
}

export interface PublicSelfEvaluation {
  public_id: string;
  cycle: {
    public_id: string;
    name: string;
  };
  submitted_at: string;
  is_edited: boolean;
  ratings: PublicSelfEvaluationRating[];
  comment: string;
  suggestion: string;
  comments: PublicSelfEvaluationComment[];
}

/** GET /members/ entry (basic profile information + public self-evaluation indicator, MEM-01). */
export interface DirectoryMember {
  public_id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  voice_section: VoiceSection;
  has_self_evaluation?: boolean;
  self_evaluation_summary?: string;
}

/** GET /members/{public_id}/ and /members/me/. */
export interface MemberDetail extends DirectoryMember {
  bio: string;
  joined_choir_on: string | null;
  is_self: boolean;
  self_evaluation?: PublicSelfEvaluation | null;
}

export interface DirectoryParams {
  search?: string;
  voice_section?: number;
  page?: number;
}

export function memberName(
  member: Pick<DirectoryMember, "first_name" | "last_name" | "display_name">,
) {
  const full = `${member.first_name} ${member.last_name}`.trim();
  return member.display_name ? `${member.display_name} (${full})` : full;
}
