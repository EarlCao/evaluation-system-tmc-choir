import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import SvgIcon from "@mui/material/SvgIcon";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router";

import { useCurrentUser, useLogout } from "../queries";

/** Header controls for logged-in users: name, person icon for profile, red logout with confirmation. */
export function AccountMenu() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();
  const [confirmLogout, setConfirmLogout] = useState(false);

  if (!user) return null;

  const isSuperAdmin = user.is_super_admin || user.role === "SUPER_ADMIN";

  const handleConfirmLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => {
        setConfirmLogout(false);
        void navigate(isSuperAdmin ? "/admin" : "/", { replace: true });
      },
    });
  };

  return (
    <>
      <Stack direction="row" spacing={{ xs: 0.5, sm: 1 }} sx={{ alignItems: "center" }}>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ display: { xs: "none", sm: "block" } }}
        >
          {user.display_name || user.first_name}
        </Typography>

        {!isSuperAdmin ? (
          <Tooltip title="Profile">
            <IconButton
              component={RouterLink}
              to="/app/profile"
              size="small"
              aria-label="Profile"
              color="inherit"
              sx={{
                p: 0.75,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                "&:hover": {
                  bgcolor: "action.hover",
                  borderColor: "text.secondary",
                },
              }}
            >
              <SvgIcon fontSize="small">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </SvgIcon>
            </IconButton>
          </Tooltip>
        ) : null}

        <Tooltip title="Log out">
          <IconButton
            size="small"
            aria-label="Log out"
            onClick={() => {
              setConfirmLogout(true);
            }}
            sx={{
              p: 0.75,
              color: "error.main",
              border: "1px solid",
              borderColor: "error.main",
              borderRadius: 2,
              "&:hover": {
                bgcolor: "error.main",
                color: "common.white",
              },
            }}
          >
            <SvgIcon fontSize="small" color="inherit">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
            </SvgIcon>
          </IconButton>
        </Tooltip>
      </Stack>

      <Dialog
        open={confirmLogout}
        onClose={() => {
          setConfirmLogout(false);
        }}
        aria-labelledby="logout-dialog-title"
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle id="logout-dialog-title" sx={{ fontWeight: 700 }}>
          Log out?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to log out of TMC Choir Evaluation System?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ pb: 2.5, px: 3 }}>
          <Button
            onClick={() => {
              setConfirmLogout(false);
            }}
            color="inherit"
            variant="text"
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={logout.isPending}
            onClick={handleConfirmLogout}
            autoFocus
          >
            {logout.isPending ? "Logging out…" : "Log out"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
