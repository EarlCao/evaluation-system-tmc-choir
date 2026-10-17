import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Link as RouterLink, useParams } from "react-router";

import { ErrorState } from "@/components/ErrorState";
import { ExportButtons } from "@/components/ExportButtons";
import { FullPageSpinner } from "@/components/FullPageSpinner";
import { NotFoundPage } from "@/components/NotFoundPage";
import { isApiError } from "@/lib/errors";

import { CriteriaTable, Explanations, Section, TrendTable } from "../components/ReportTables";
import { useMemberSummary } from "../queries";

/** REP-01 / REP-02: one member's received ratings over time (Super Admin view). */
export function MemberReportPage() {
  const { publicId = "" } = useParams();
  const summary = useMemberSummary(publicId, {});
  if (summary.isPending) return <FullPageSpinner label="Loading report" />;
  if (summary.isError) {
    if (isApiError(summary.error) && summary.error.status === 404) return <NotFoundPage />;
    return (
      <ErrorState message="We couldn't load the report." onRetry={() => void summary.refetch()} />
    );
  }
  const { member } = summary.data;
  const name = `${member.first_name} ${member.last_name}`;
  return (
    <Stack spacing={3} sx={{ py: 4, maxWidth: 960 }}>
      <Link component={RouterLink} to="/admin/reports?view=participation">
        ← Reports
      </Link>
      <Typography variant="h4" component="h1">
        Report: {name}
      </Typography>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Typography>
            {member.voice_section ?? "No voice section"} · {summary.data.evaluations_received}{" "}
            evaluations received · {summary.data.evaluations_given} given
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button
              component={RouterLink}
              to={`/admin/evaluations?recipient=${member.public_id}`}
              variant="outlined"
              size="small"
            >
              Evaluations about them (shows authors)
            </Button>
            <Button
              component={RouterLink}
              to={`/admin/members/${member.public_id}`}
              variant="outlined"
              size="small"
            >
              Account
            </Button>
          </Stack>
        </Stack>
      </Paper>
      <ExportButtons report="member" filters={{ member: member.public_id }} />
      <Section
        title="Criteria"
        note="Super Admin view: figures are shown even when few members rated (n is shown)."
      >
        <CriteriaTable criteria={summary.data.criteria} />
      </Section>
      <Section title="By period">
        <TrendTable trend={summary.data.trend} />
      </Section>
      <Explanations />
    </Stack>
  );
}
