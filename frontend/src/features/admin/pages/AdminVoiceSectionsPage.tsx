import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { Link as RouterLink } from "react-router";

import { ErrorState } from "@/components/ErrorState";
import { FullPageSpinner } from "@/components/FullPageSpinner";
import { isApiError } from "@/lib/errors";

import { useAdminVoiceSections, useVoiceSectionMutations } from "../queries";
import type { AdminVoiceSection } from "../types";

function SectionRow({ section }: { section: AdminVoiceSection }) {
  const { update } = useVoiceSectionMutations();
  const [name, setName] = useState(section.name);
  const changed = name.trim() !== section.name;
  return (
    <TableRow>
      <TableCell>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <TextField
            size="small"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
            slotProps={{ htmlInput: { "aria-label": `Name of ${section.name}`, maxLength: 50 } }}
          />
          {changed ? (
            <Button
              size="small"
              onClick={() => {
                update.mutate({ id: section.id, changes: { name: name.trim() } });
              }}
            >
              Save
            </Button>
          ) : null}
        </Stack>
      </TableCell>
      <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>
        {section.member_count ?? 0}
      </TableCell>
      <TableCell>
        <Switch
          checked={section.is_active}
          onChange={(e) => {
            update.mutate({ id: section.id, changes: { is_active: e.target.checked } });
          }}
          slotProps={{ input: { "aria-label": `${section.name} is offered at registration` } }}
        />
      </TableCell>
    </TableRow>
  );
}

/** MEM-05: voice sections. Deactivate instead of delete; profiles keep their section. */
export function AdminVoiceSectionsPage() {
  const sections = useAdminVoiceSections();
  const { create } = useVoiceSectionMutations();
  const [name, setName] = useState("");

  if (sections.isPending) return <FullPageSpinner label="Loading voice sections" />;
  if (sections.isError) {
    return (
      <ErrorState
        message="We couldn't load voice sections."
        onRetry={() => void sections.refetch()}
      />
    );
  }
  return (
    <Stack spacing={3} sx={{ py: 4, maxWidth: 720 }}>
      <Link component={RouterLink} to="/admin/members">
        ← Members
      </Link>
      <Typography variant="h4" component="h1">
        Voice sections
      </Typography>
      <Typography color="text.secondary">
        Inactive sections are no longer offered at registration. Members already in them keep them.
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label="Voice sections">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell align="right">Members</TableCell>
              <TableCell>Offered</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sections.data.map((s) => (
              <SectionRow key={`${String(s.id)}-${s.name}`} section={s} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Stack
        component="form"
        direction="row"
        spacing={1}
        aria-label="Add a voice section"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(name.trim(), {
            onSuccess: () => {
              setName("");
            },
          });
        }}
      >
        <TextField
          size="small"
          label="New voice section"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
          }}
          slotProps={{ htmlInput: { maxLength: 50 } }}
        />
        <Button type="submit" variant="contained" disabled={!name.trim() || create.isPending}>
          Add
        </Button>
      </Stack>
      {create.isError ? (
        <Alert severity="error">
          {isApiError(create.error)
            ? ((Object.values(create.error.fields).flat()[0] as string | undefined) ??
              create.error.message)
            : "Something went wrong."}
        </Alert>
      ) : null}
    </Stack>
  );
}
