import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import { useNavigate } from "react-router";

import { useMarkRead } from "../queries";
import type { AppNotification } from "../types";

/** Notifications as plain text (never HTML). Opening one marks it read and follows its link. */
export function NotificationList({
  items,
  onOpen,
  label = "Notifications",
}: {
  items: AppNotification[];
  onOpen?: () => void;
  label?: string;
}) {
  const navigate = useNavigate();
  const markRead = useMarkRead();
  return (
    <List aria-label={label} disablePadding>
      {items.map((n) => (
        <ListItemButton
          key={n.public_id}
          onClick={() => {
            if (!n.is_read) markRead.mutate(n.public_id);
            onOpen?.();
            if (n.link.startsWith("/")) void navigate(n.link);
          }}
          sx={{ alignItems: "flex-start", gap: 1.5 }}
        >
          <Box
            aria-hidden
            sx={{
              mt: 1,
              width: 8,
              height: 8,
              borderRadius: "50%",
              flexShrink: 0,
              bgcolor: n.is_read ? "transparent" : "primary.main",
            }}
          />
          <ListItemText
            primary={
              <>
                {n.message}
                {n.is_read ? null : (
                  <Typography component="span" sx={visuallyHidden}>
                    {" "}
                    (unread)
                  </Typography>
                )}
              </>
            }
            secondary={new Date(n.created_at).toLocaleString()}
            slotProps={{ primary: { sx: { fontWeight: n.is_read ? 400 : 600 } } }}
          />
        </ListItemButton>
      ))}
    </List>
  );
}

const visuallyHidden = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
} as const;
