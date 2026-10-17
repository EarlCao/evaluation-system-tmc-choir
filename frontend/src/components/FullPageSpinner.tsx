import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";

export function FullPageSpinner({ label = "Loading" }: { label?: string }) {
  return (
    <Box sx={{ display: "grid", placeItems: "center", minHeight: "50vh" }}>
      <CircularProgress aria-label={label} />
    </Box>
  );
}
