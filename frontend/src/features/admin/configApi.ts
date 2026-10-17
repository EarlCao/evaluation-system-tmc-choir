import { apiClient } from "@/lib/apiClient";
import type { Paginated } from "@/lib/pagination";

import type {
  AdminCycle,
  Category,
  Criterion,
  CriterionInput,
  CriterionVersion,
  CycleInput,
  FormInput,
  FormVersion,
} from "./configTypes";

const ALL = { params: { page_size: 100 } };

// Categories
export const fetchCategories = async () =>
  (await apiClient.get<Category[]>("/admin/criterion-categories/")).data;
export const createCategory = async (name: string) =>
  (await apiClient.post<Category>("/admin/criterion-categories/", { name })).data;

// Criteria
export const fetchCriteria = async (includeArchived: boolean) =>
  (
    await apiClient.get<Criterion[]>("/admin/criteria/", {
      params: { include_archived: includeArchived ? "true" : undefined },
    })
  ).data;
export const createCriterion = async (input: CriterionInput) =>
  (await apiClient.post<Criterion>("/admin/criteria/", input)).data;
export const updateCriterion = async (
  id: string,
  changes: Partial<CriterionInput> & { is_active?: boolean },
) => (await apiClient.patch<Criterion>(`/admin/criteria/${id}/`, changes)).data;
export const archiveCriterion = async (id: string) =>
  (await apiClient.post<Criterion>(`/admin/criteria/${id}/archive/`)).data;
export const reorderCriteria = async (order: string[]) =>
  (await apiClient.post<Criterion[]>("/admin/criteria/reorder/", { order })).data;
export const fetchCriterionVersions = async (id: string) =>
  (await apiClient.get<CriterionVersion[]>(`/admin/criteria/${id}/versions/`)).data;

// Form versions
export const fetchForms = async () =>
  (await apiClient.get<Paginated<FormVersion>>("/admin/form-versions/", ALL)).data.results;
export const fetchForm = async (id: string) =>
  (await apiClient.get<FormVersion>(`/admin/form-versions/${id}/`)).data;
export const createForm = async (input: FormInput) =>
  (await apiClient.post<FormVersion>("/admin/form-versions/", input)).data;
export const updateForm = async (id: string, input: Partial<FormInput>) =>
  (await apiClient.patch<FormVersion>(`/admin/form-versions/${id}/`, input)).data;
export const publishForm = async (id: string) =>
  (await apiClient.post<FormVersion>(`/admin/form-versions/${id}/publish/`)).data;

// Cycles
export const fetchCycles = async () =>
  (await apiClient.get<Paginated<AdminCycle>>("/admin/evaluation-cycles/", ALL)).data.results;
export const fetchCycle = async (id: string) =>
  (await apiClient.get<AdminCycle>(`/admin/evaluation-cycles/${id}/`)).data;
export const createCycle = async (input: CycleInput) =>
  (await apiClient.post<AdminCycle>("/admin/evaluation-cycles/", input)).data;
export const updateCycle = async (id: string, input: CycleInput) =>
  (await apiClient.patch<AdminCycle>(`/admin/evaluation-cycles/${id}/`, input)).data;
export const transitionCycle = async (id: string, action: "open" | "close" | "archive") =>
  (await apiClient.post<AdminCycle>(`/admin/evaluation-cycles/${id}/${action}/`)).data;
