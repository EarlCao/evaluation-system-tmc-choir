import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
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
import { useVoiceSections } from "@/features/auth";
import { pageCount } from "@/lib/pagination";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

import { useDirectory } from "../queries";
import { memberName, type DirectoryMember } from "../types";

function positiveInt(value: string | null): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

function MemberCard({ member }: { member: DirectoryMember }) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardActionArea
        component={RouterLink}
        to={`/app/members/${member.public_id}`}
        sx={{ height: "100%" }}
      >
        <CardContent>
          <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600 }}>
            {memberName(member)}
          </Typography>
          <Chip size="small" label={member.voice_section.name} sx={{ mt: 1 }} />
        </CardContent>
      </CardActionArea>
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
                <MemberCard member={member} />
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
