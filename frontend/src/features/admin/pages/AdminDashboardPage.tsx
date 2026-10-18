import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { ErrorState } from "@/components/ErrorState";
import { Meter } from "@/components/Meter";

import { StatTile } from "../components/StatTile";
import { useAdminDashboard } from "../queries";
import type { AdminOpenCycle } from "../types";

function OpenCycleCard({ cycle }: { cycle: AdminOpenCycle | null }) {
  if (!cycle) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" component="h2">
            No evaluation period is open
          </Typography>
          <Typography color="text.secondary">
            Open a period from Cycles & criteria to let members evaluate each other.
          </Typography>
        </CardContent>
      </Card>
    );
  }
  const percent = cycle.participation_percent;
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <div>
            <Typography variant="h6" component="h2">
              {cycle.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Open until {new Date(cycle.ends_at).toLocaleDateString()} ·{" "}
              {cycle.evaluation_scope === "SAME_SECTION"
                ? "members evaluate their own section"
                : "everyone evaluates everyone"}
            </Typography>
          </div>
          {percent === null ? (
            <Typography color="text.secondary">
              No member can evaluate anyone in this period yet.
            </Typography>
          ) : (
            <>
              <Typography variant="h4" component="p" sx={{ fontWeight: 600 }}>
                {percent}%
                <Typography component="span" variant="body1" color="text.secondary">
                  {" "}
                  participation
                </Typography>
              </Typography>
              <Meter
                label="Participation"
                value={percent}
                min={0}
                max={100}
                valueText={`${String(percent)} percent`}
              />
              <Typography variant="body2" color="text.secondary">
                {cycle.submitted_pairs} of {cycle.possible_pairs} possible evaluations ·{" "}
                {cycle.participating_members} members took part · {cycle.evaluations_submitted}{" "}
                submissions
              </Typography>
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

/** ADM-01: system-wide statistics. */
export function AdminDashboardPage() {
  const dashboard = useAdminDashboard();
  return (
    <Stack spacing={3} sx={{ py: 4 }}>
      <Card
        variant="outlined"
        sx={{
          p: { xs: 2.5, sm: 3.5 },
          background:
            "linear-gradient(135deg, rgba(212, 175, 55, 0.1) 0%, rgba(30, 27, 75, 0.06) 100%)",
        }}
      >
        <Typography variant="overline" color="primary" sx={{ fontWeight: 800 }}>
          TMC Choir Administration
        </Typography>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>
          Super Admin dashboard
        </Typography>
      </Card>
      {dashboard.isError ? (
        <ErrorState
          message="We couldn't load the statistics."
          onRetry={() => void dashboard.refetch()}
        />
      ) : dashboard.isPending ? (
        <Skeleton variant="rounded" height={160} />
      ) : (
        <>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: "grow" }}>
              <StatTile
                label="Active members"
                value={dashboard.data.members.active}
                hint={`${String(dashboard.data.members.registered)} registered`}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: "grow" }}>
              <StatTile
                label="Waiting for approval"
                value={dashboard.data.members.pending}
                to="/admin/members?status=PENDING"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: "grow" }}>
              <StatTile
                label="Suspended or deactivated"
                value={dashboard.data.members.suspended + dashboard.data.members.deactivated}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: "grow" }}>
              <StatTile
                label="Evaluations submitted"
                value={dashboard.data.evaluations_submitted}
                hint="All periods"
                to="/admin/evaluations"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: "grow" }}>
              <StatTile
                label="Needs moderation"
                value={dashboard.data.needs_moderation}
                to="/admin/moderation"
              />
            </Grid>
          </Grid>
          <OpenCycleCard cycle={dashboard.data.open_cycle} />
          <Typography variant="body2" color="text.secondary">
            Periods: {dashboard.data.cycles.DRAFT} draft · {dashboard.data.cycles.OPEN} open ·{" "}
            {dashboard.data.cycles.CLOSED} closed · {dashboard.data.cycles.ARCHIVED} archived
          </Typography>
        </>
      )}
    </Stack>
  );
}
