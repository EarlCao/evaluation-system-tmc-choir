import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Link } from "react-router";

import { ApiStatus } from "@/components/ApiStatus";

export function WelcomePage() {
  return (
    <Stack spacing={3} sx={{ py: { xs: 6, md: 10 }, maxWidth: 720 }}>
      <Typography variant="h3" component="h1">
        Choir Member Evaluation System
      </Typography>
      <Typography variant="h6" component="p" color="text.secondary">
        A private, constructive way for choir members to give each other feedback. Your name is
        never shown to the members you evaluate.
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Button component={Link} to="/login" variant="contained" size="large">
          Log in
        </Button>
        <Button component={Link} to="/register" variant="outlined" size="large">
          Create an account
        </Button>
      </Stack>
      <div>
        <ApiStatus />
      </div>
    </Stack>
  );
}
