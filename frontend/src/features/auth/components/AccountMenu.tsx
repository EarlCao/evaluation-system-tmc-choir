import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Link as RouterLink, useNavigate } from "react-router";

import { useCurrentUser, useLogout } from "../queries";

/** Header controls for logged-in users: name, profile link (members only), log out. */
export function AccountMenu() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();
  if (!user) return null;

  const isSuperAdmin = user.is_super_admin || user.role === "SUPER_ADMIN";

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ display: { xs: "none", sm: "block" } }}
      >
        {user.display_name || user.first_name}
      </Typography>
      {!isSuperAdmin ? (
        <Button component={RouterLink} to="/app/profile" size="small">
          Profile
        </Button>
      ) : null}
      <Button
        size="small"
        variant="outlined"
        disabled={logout.isPending}
        onClick={() => {
          logout.mutate(undefined, {
            onSettled: () => {
              void navigate(isSuperAdmin ? "/admin" : "/", { replace: true });
            },
          });
        }}
      >
        Log out
      </Button>
    </Stack>
  );
}

