import { ShieldCheck } from "lucide-react";

import type { RouteOption } from "../types";

interface RecommendationBannerProps {
  route: RouteOption | undefined;
  reason: string;
}

export function RecommendationBanner({ route, reason }: RecommendationBannerProps) {
  return (
    <div className="flex gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3.5">
      <ShieldCheck className="mt-0.5 size-5 shrink-0 text-sky-700" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-sky-950">
          Recommended: {route ? route.name : "no route"}
          {route?.via && <span className="font-normal text-sky-800"> via {route.via}</span>}
        </p>
        {reason && <p className="mt-0.5 text-xs leading-relaxed text-sky-900/80">{reason}</p>}
      </div>
    </div>
  );
}
