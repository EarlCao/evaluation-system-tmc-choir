import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Link as RouterLink } from "react-router";

import { ErrorState } from "@/components/ErrorState";
import { useCurrentUser } from "@/features/auth";

import { useMemberDashboard } from "../queries";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h4" component="p">
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const { data: user } = useCurrentUser();
  const dashboard = useMemberDashboard();

  return (
    <Stack spacing={3} sx={{ py: 4 }}>
      <Typography variant="h4" component="h1">
        Welcome{user ? `, ${user.display_name || user.first_name}` : ""}
      </Typography>

      {dashboard.isError ? (
        <ErrorState
          message="We couldn't load your dashboard."
          onRetry={() => void dashboard.refetch()}
        />
      ) : (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            {dashboard.isPending ? (
              <Skeleton variant="rounded" height={104} />
            ) : (
              <StatCard label="Active choir members" value={dashboard.data.active_members} />
            )}
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            {dashboard.isPending ? (
              <Skeleton variant="rounded" height={104} />
            ) : (
              <StatCard label="Your voice section" value={dashboard.data.voice_section ?? "—"} />
            )}
          </Grid>
        </Grid>
      )}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Button component={RouterLink} to="/app/members" variant="contained">
          Browse members
        </Button>
        <Button component={RouterLink} to="/app/profile" variant="outlined">
          Your account
        </Button>
      </Stack>
    </Stack>
  );
}
