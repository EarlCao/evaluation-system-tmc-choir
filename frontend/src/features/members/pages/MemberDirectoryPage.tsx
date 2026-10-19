import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Pagination from "@mui/material/Pagination";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import { Link as RouterLink, useSearchParams } from "react-router";

import { ErrorState } from "@/components/ErrorState";
import { useCurrentUser, useVoiceSections } from "@/features/auth";
import { useCurrentCycle } from "@/features/evaluations";
import { pageCount } from "@/lib/pagination";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

import { useDirectory } from "../queries";
import { memberName, type DirectoryMember } from "../types";

function positiveInt(value: string | null): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

function MemberCard({
  member,
  isSelf,
  canEvaluate,
}: {
  member: DirectoryMember;
  isSelf: boolean;
  canEvaluate: boolean;
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <CardActionArea
        component={RouterLink}
        to={`/app/members/${member.public_id}`}
        sx={{ flexGrow: 1 }}
      >
        <CardContent>
          <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600 }}>
            {memberName(member)}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", gap: 0.5 }}>
            <Chip size="small" label={member.voice_section.name} />
            {member.is_officer ? (
              <Chip
                size="small"
                color="secondary"
                label={
                  member.officer_position ? `Officer: ${member.officer_position}` : "Choir Officer"
                }
              />
            ) : null}
            {isSelf ? <Chip size="small" label="You" color="primary" variant="outlined" /> : null}
            {member.has_self_evaluation ? (
              <Chip
                size="small"
                label="Self-evaluated"
                color="success"
                variant="outlined"
              />
            ) : null}
          </Stack>
          {member.self_evaluation_summary ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 1.5,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                fontStyle: "italic",
              }}
            >
              “{member.self_evaluation_summary}”
            </Typography>
          ) : null}
        </CardContent>
      </CardActionArea>
      {canEvaluate ? (
        <CardActions sx={{ px: 2, pb: 1.5, pt: 0 }}>
          <Button
            component={RouterLink}
            to={`/app/members/${member.public_id}/evaluate`}
            size="small"
            variant={isSelf ? "outlined" : "contained"}
          >
            {isSelf ? "Evaluate yourself" : "Evaluate"}
          </Button>
        </CardActions>
      ) : null}
    </Card>
  );
}

/** MEM-01 / MEM-02: the choir directory. Filters live in the URL so links and Back work. */
export function MemberDirectoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const search = useDebouncedValue(searchInput.trim());
  const voiceSection = positiveInt(searchParams.get("voice_section"));
  const page = positiveInt(searchParams.get("page")) ?? 1;

  const me = useCurrentUser().data;
  const openCycle = useCurrentCycle().data;
  const sections = useVoiceSections();
  const directory = useDirectory({ search, voice_section: voiceSection, page });

  function updateParams(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setSearchParams(next, { replace: true });
  }

  // Mirror the debounced search into the URL (and go back to page 1).
  const urlSearch = searchParams.get("search") ?? "";
  useEffect(() => {
    if (search === urlSearch) return;
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (search) next.set("search", search);
        else next.delete("search");
        next.delete("page");
        return next;
      },
      { replace: true },
    );
  }, [search, urlSearch, setSearchParams]);

  return (
    <Stack spacing={3} sx={{ py: 4 }}>
      <Typography variant="h4" component="h1">
        Choir members
      </Typography>

      {openCycle ? (
        <Alert
          severity="info"
          action={
            me && !me.is_super_admin ? (
              <Button
                component={RouterLink}
                to={`/app/members/${me.public_id}/evaluate`}
                color="inherit"
                size="small"
              >
                Evaluate yourself
              </Button>
            ) : undefined
          }
        >
          Evaluation period <strong>{openCycle.name}</strong> is open until{" "}
          {new Date(openCycle.ends_at).toLocaleDateString()}. Click <strong>Evaluate</strong> on a
          member below to rate criteria and leave comments, or click{" "}
          <strong>Evaluate yourself</strong> to post your public self-evaluation and comments for all
          members to see.
        </Alert>
      ) : null}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          label="Search by name"
          type="search"
          value={searchInput}
          onChange={(event) => {
            setSearchInput(event.target.value);
          }}
          sx={{ flex: 2 }}
        />
        <TextField
          select
          label="Voice section"
          value={voiceSection ? String(voiceSection) : ""}
          onChange={(event) => {
            updateParams({ voice_section: event.target.value || undefined, page: undefined });
          }}
          sx={{ flex: 1, minWidth: 180 }}
        >
          <MenuItem value="">All sections</MenuItem>
          {(sections.data ?? []).map((section) => (
            <MenuItem key={section.id} value={String(section.id)}>
              {section.name}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {directory.isError ? (
        <ErrorState
          message="We couldn't load the member list."
          onRetry={() => void directory.refetch()}
        />
      ) : directory.isPending ? (
        <Grid container spacing={2} aria-busy="true" aria-label="Loading members">
          {Array.from({ length: 6 }, (_, i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
              <Skeleton variant="rounded" height={88} />
            </Grid>
          ))}
        </Grid>
      ) : directory.data.results.length === 0 ? (
        <Typography color="text.secondary">No members match your search.</Typography>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" role="status">
            {directory.data.count} {directory.data.count === 1 ? "member" : "members"}
          </Typography>
          <Grid
            container
            spacing={2}
            component="ul"
            aria-label="Members"
            sx={{ listStyle: "none", p: 0, m: 0 }}
          >
            {directory.data.results.map((member) => (
              <Grid key={member.public_id} size={{ xs: 12, sm: 6, md: 4 }} component="li">
                <MemberCard
                  member={member}
                  isSelf={member.public_id === me?.public_id}
                  canEvaluate={Boolean(openCycle) && !me?.is_super_admin}
                />
              </Grid>
            ))}
          </Grid>
          {pageCount(directory.data.count) > 1 ? (
            <Pagination
              count={pageCount(directory.data.count)}
              page={page}
              onChange={(_, value) => {
                updateParams({ page: value > 1 ? String(value) : undefined });
              }}
              sx={{ alignSelf: "center" }}
            />
          ) : null}
        </>
      )}
    </Stack>
  );
}
