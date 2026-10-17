import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import { Link as RouterLink } from "react-router";

/** Shown on every page: the privacy notice is always one click away (SET-03). */
export function SiteFooter() {
  return (
    <Box component="footer" sx={{ py: 3, textAlign: "center" }}>
      <Link component={RouterLink} to="/privacy" variant="body2" color="text.secondary">
        Privacy: who sees what
      </Link>
    </Box>
  );
}
