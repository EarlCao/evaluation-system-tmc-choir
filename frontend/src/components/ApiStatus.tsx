import Chip from "@mui/material/Chip";

import { useHealth } from "@/lib/health";

/** Small live indicator of backend health (GET /api/v1/health/ through the proxy). */
export function ApiStatus() {
  const { data, isPending, isError } = useHealth();

  const state = isPending
    ? "checking"
    : !isError && data.status === "ok"
      ? "online"
      : "unavailable";
  const label = { checking: "Checking API…", online: "API online", unavailable: "API unavailable" }[
    state
  ];
  const color = { checking: "default", online: "success", unavailable: "error" } as const;

  return (
    <Chip
      size="small"
      variant="outlined"
      label={label}
      color={color[state]}
      role="status"
      aria-live="polite"
    />
  );
}
