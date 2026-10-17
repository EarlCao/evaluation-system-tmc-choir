import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import { NavLink } from "react-router";

/** Super Admin navigation; entries are added as the admin pages are built (Phase 4). */
const ADMIN_LINKS = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/members", label: "Members", end: false },
  { to: "/admin/cycles", label: "Periods", end: false },
  { to: "/admin/criteria", label: "Criteria", end: false },
  { to: "/admin/forms", label: "Forms", end: false },
];

export function AdminNav() {
  return (
    <Stack
      component="nav"
      aria-label="Admin"
      direction="row"
      spacing={0.5}
      sx={{ flexWrap: "wrap" }}
    >
      {ADMIN_LINKS.map((link) => (
        <Button
          key={link.to}
          component={NavLink}
          to={link.to}
          end={link.end}
          size="small"
          color="inherit"
          sx={{ "&.active": { color: "primary.main", fontWeight: 700 } }}
        >
          {link.label}
        </Button>
      ))}
    </Stack>
  );
}
