/**
 * QA/security audit, 2026-07-22 (TC-FUNC-01 / TC-PERF-01): every list
 * endpoint used to run an unbounded `findMany` scoped only by `clinicId` —
 * fine at demo scale, a real latency/memory risk at real clinic scale.
 *
 * Response shape is deliberately NOT changed to `{ data, total }` — every
 * existing caller of e.g. `apiFetch<Patient[]>("/patients")` expects a
 * plain array, and changing that would be a breaking ripple through every
 * consumer (patient/doctor pickers in half a dozen other forms) with no
 * running app in this environment to verify each one still works. Instead:
 * the JSON body stays a plain, bounded array; total count (for building
 * real pager UI) rides along on an `X-Total-Count` response header, read
 * via `apiFetchPaginated` (apps/web/src/lib/api.ts) — opt-in, not breaking.
 *
 * Only `/patients` has real pager *controls* wired up in the frontend today
 * (the endpoint the finding's own example named) — every other list route
 * applies this same bounding (so nothing is unbounded anymore) without a
 * frontend page-through UI yet. See README § Frontend conventions for the
 * list of which pages still need one.
 */
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export interface PageParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export function parsePageParams(page?: string, pageSize?: string): PageParams {
  const parsedPage = Math.max(1, Math.trunc(Number(page)) || 1);
  const requestedSize = Math.trunc(Number(pageSize)) || DEFAULT_PAGE_SIZE;
  const parsedPageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, requestedSize));
  return {
    page: parsedPage,
    pageSize: parsedPageSize,
    skip: (parsedPage - 1) * parsedPageSize,
    take: parsedPageSize,
  };
}
