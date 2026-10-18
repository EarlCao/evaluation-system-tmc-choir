import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Link as RouterLink } from "react-router";

import { ErrorState } from "@/components/ErrorState";
import { useCurrentUser } from "@/features/auth";

import type { OpenCycleProgress } from "../api";
import { useMemberDashboard } from "../queries";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card variant="outlined" sx={{ height: "100%", overflow: "hidden" }}>
      <Box
        aria-hidden="true"
        sx={{
          height: 4,
          background: "linear-gradient(90deg, #1e1b4b 0%, #d4af37 50%, #0f766e 100%)",
        }}
      />
      <CardContent sx={{ p: 2.5 }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5 }}>
          {label}
        </Typography>
        <Typography variant="h4" component="p" sx={{ fontWeight: 800 }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

function CycleCard({ cycle }: { cycle: OpenCycleProgress | null }) {
  if (!cycle) {
    return (
      <Card variant="outlined">
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" component="h2" gutterBottom>
            No evaluation period is open
          </Typography>
          <Typography color="text.secondary">
            You'll be able to evaluate members when the Super Admin opens the next period.
          </Typography>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: "primary.main",
        background:
          "linear-gradient(135deg, rgba(212, 175, 55, 0.08) 0%, rgba(30, 27, 75, 0.06) 100%)",
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Stack spacing={1.5}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Chip label="Active Period" color="primary" size="small" />
            <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
              {cycle.name} is open
            </Typography>
          </Box>
          <Typography color="text.secondary">
            Until {new Date(cycle.ends_at).toLocaleDateString()} · you have evaluated{" "}
            {cycle.evaluations_given} {cycle.evaluations_given === 1 ? "member" : "members"}
            {cycle.members_left > 0 ? `, ${String(cycle.members_left)} to go` : ""}.
          </Typography>
          <div>
            <Button component={RouterLink} to="/app/members" variant="contained">
              {cycle.members_left > 0 ? "Evaluate members" : "Browse members"}
            </Button>
          </div>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const { data: user } = useCurrentUser();
  const dashboard = useMemberDashboard();

  return (
    <Stack spacing={3} sx={{ py: 4 }}>
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 2.5, sm: 3.5 },
          background:
            "linear-gradient(135deg, rgba(212, 175, 55, 0.1) 0%, rgba(30, 27, 75, 0.06) 100%)",
        }}
      >
        <Typography variant="overline" color="primary" sx={{ fontWeight: 800 }}>
          TMC Choir Member Portal
        </Typography>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>
          Welcome{user ? `, ${user.display_name || user.first_name}` : ""}
        </Typography>
      </Paper>

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
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            {dashboard.isPending ? (
              <Skeleton variant="rounded" height={104} />
            ) : (
              <StatCard label="Evaluations you received" value={dashboard.data.feedback_received} />
            )}
          </Grid>
        </Grid>
      )}

      {dashboard.isSuccess ? <CycleCard cycle={dashboard.data.open_cycle} /> : null}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Button component={RouterLink} to="/app/feedback" variant="outlined">
          Feedback I received
        </Button>
        <Button component={RouterLink} to="/app/my-evaluations" variant="outlined">
          My evaluations
        </Button>
        <Button component={RouterLink} to="/app/profile" variant="outlined">
          Your account
        </Button>
      </Stack>
    </Stack>
  );
}

