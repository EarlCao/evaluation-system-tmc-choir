import type { VoiceSection } from "@/features/auth";

/** GET /members/ entry (basic profile information only, MEM-01). */
export interface DirectoryMember {
  public_id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  voice_section: VoiceSection;
}

/** GET /members/{public_id}/ and /members/me/. */
export interface MemberDetail extends DirectoryMember {
  bio: string;
  joined_choir_on: string | null;
  is_self: boolean;
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
