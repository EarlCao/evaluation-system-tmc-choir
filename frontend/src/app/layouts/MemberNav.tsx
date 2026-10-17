import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import { NavLink } from "react-router";

const LINKS = [
  { to: "/app", label: "Dashboard", end: true },
  { to: "/app/members", label: "Members", end: false },
  { to: "/app/my-evaluations", label: "My evaluations", end: false },
];

/** Primary navigation of the member area. NavLink sets aria-current="page". */
export function MemberNav() {
  return (
    <Stack component="nav" aria-label="Main" direction="row" spacing={0.5}>
      {LINKS.map((link) => (
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
