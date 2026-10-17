import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Link as RouterLink, useNavigate } from "react-router";

import { useCurrentUser, useLogout } from "../queries";

/** Header controls for logged-in users: name, profile link, log out. */
export function AccountMenu() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();
  if (!user) return null;

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ display: { xs: "none", sm: "block" } }}
      >
        {user.display_name || user.first_name}
      </Typography>
      <Button component={RouterLink} to="/app/profile" size="small">
        Profile
      </Button>
      <Button
        size="small"
        variant="outlined"
        disabled={logout.isPending}
        onClick={() => {
          logout.mutate(undefined, {
            onSettled: () => {
              void navigate("/", { replace: true });
            },
          });
        }}
      >
        Log out
      </Button>
    </Stack>
  );
}
