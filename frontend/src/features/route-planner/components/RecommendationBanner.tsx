import { ShieldCheck } from "lucide-react";

import type { RouteOption } from "../types";

interface RecommendationBannerProps {
  route: RouteOption | undefined;
  reason: string;
}

export function RecommendationBanner({ route, reason }: RecommendationBannerProps) {
  return (
    <div className="flex gap-3 rounded-xl bg-accent-soft p-3.5 ring-1 ring-accent-line">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-fg">
        <ShieldCheck className="size-4.5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-fg">
          Recommended: <span className="text-accent">{route ? route.name : "no route"}</span>
          {route?.via && <span className="font-normal text-muted"> via {route.via}</span>}
        </p>
        {reason && <p className="mt-0.5 text-xs leading-relaxed text-muted">{reason}</p>}
      </div>
    </div>
  );
}
