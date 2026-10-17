import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as api from "./api";
import type { DirectoryParams } from "./types";

export const memberKeys = {
  all: ["members"] as const,
  directory: (params: DirectoryParams) => [...memberKeys.all, "directory", params] as const,
  detail: (publicId: string) => [...memberKeys.all, "detail", publicId] as const,
};

export function useDirectory(params: DirectoryParams) {
  return useQuery({
    queryKey: memberKeys.directory(params),
    queryFn: () => api.fetchDirectory(params),
    placeholderData: keepPreviousData,
  });
}

export function useMember(publicId: string) {
  return useQuery({
    queryKey: memberKeys.detail(publicId),
    queryFn: () => api.fetchMember(publicId),
  });
}

export function useUpdateOwnBio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.updateOwnBio,
    onSuccess: (profile) => {
      queryClient.setQueryData(memberKeys.detail(profile.public_id), profile);
    },
  });
}
