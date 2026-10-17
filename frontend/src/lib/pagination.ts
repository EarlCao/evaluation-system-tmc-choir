/** DRF page envelope (docs/06-API/API Conventions). */
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export const PAGE_SIZE = 20;

export function pageCount(count: number, pageSize = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(count / pageSize));
}
