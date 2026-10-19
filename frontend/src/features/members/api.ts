import { apiClient } from "@/lib/apiClient";
import type { Paginated } from "@/lib/pagination";

import type { DirectoryMember, DirectoryParams, MemberDetail } from "./types";

export async function fetchDirectory(params: DirectoryParams): Promise<Paginated<DirectoryMember>> {
  const { data } = await apiClient.get<Paginated<DirectoryMember>>("/members/", {
    params: {
      search: params.search || undefined,
      voice_section: params.voice_section,
      page: params.page && params.page > 1 ? params.page : undefined,
    },
  });
  return data;
}

export async function fetchMember(publicId: string): Promise<MemberDetail> {
  const { data } = await apiClient.get<MemberDetail>(`/members/${encodeURIComponent(publicId)}/`);
  return data;
}

export async function updateOwnBio(
  input: string | { bio?: string; is_officer?: boolean; officer_position?: string },
): Promise<MemberDetail> {
  const payload = typeof input === "string" ? { bio: input } : input;
  const { data } = await apiClient.patch<MemberDetail>("/members/me/", payload);
  return data;
}
