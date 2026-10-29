/**
 * Server state for the route planner: request functions, the query-key
 * factory and the hooks components use. Planning is a mutation (user action,
 * never refetched); geocoding and the heatmap grid are cacheable queries.
 */
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";

import { apiRequest } from "@/api/client";

import type {
  GeocodeResponse,
  HeatmapRequest,
  HeatmapResponse,
  PlanRequest,
  PlanResponse,
} from "./types";

export const GEOCODE_MIN_CHARS = 3;

export const routePlannerKeys = {
  all: ["route-planner"] as const,
  geocode: (query: string) => [...routePlannerKeys.all, "geocode", query] as const,
  // the corridor can hold thousands of points; departure + load + bbox identify a plan's grid cheaply
  heatmap: (plan: PlanResponse) =>
    [
      ...routePlannerKeys.all,
      "heatmap",
      plan.departure_time,
      plan.load_lbs,
      plan.corridor.bbox.join(","),
      plan.corridor.points.length,
    ] as const,
};

export function fetchGeocode(query: string, signal?: AbortSignal): Promise<GeocodeResponse> {
  return apiRequest<GeocodeResponse>(`/api/geocode?q=${encodeURIComponent(query)}`, { signal });
}

export function postPlan(request: PlanRequest): Promise<PlanResponse> {
  return apiRequest<PlanResponse>("/api/plan", { method: "POST", body: request });
}

export function postHeatmap(request: HeatmapRequest, signal?: AbortSignal): Promise<HeatmapResponse> {
  return apiRequest<HeatmapResponse>("/api/heatmap", { method: "POST", body: request, signal });
}

export function useGeocode(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: routePlannerKeys.geocode(trimmed.toLowerCase()),
    queryFn: ({ signal }) => fetchGeocode(trimmed, signal),
    enabled: trimmed.length >= GEOCODE_MIN_CHARS,
    staleTime: 10 * 60_000,
    // keep the previous suggestions visible while the next keystroke resolves
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function usePlanRoute() {
  return useMutation({ mutationFn: postPlan });
}

export function useHeatmap(plan: PlanResponse | undefined) {
  return useQuery({
    queryKey: plan ? routePlannerKeys.heatmap(plan) : [...routePlannerKeys.all, "heatmap", "idle"],
    queryFn: ({ signal }) =>
      postHeatmap(
        { points: plan!.corridor.points, start_time: plan!.departure_time, load_lbs: plan!.load_lbs },
        signal,
      ),
    enabled: plan !== undefined && plan.corridor.points.length > 0,
    staleTime: 15 * 60_000,
    retry: 1,
  });
}
