import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { Link as RouterLink, useParams } from "react-router";

import { ErrorState } from "@/components/ErrorState";
import { FormAlert } from "@/components/form/FormAlert";
import { FullPageSpinner } from "@/components/FullPageSpinner";
import { NotFoundPage } from "@/components/NotFoundPage";
import { isApiError } from "@/lib/errors";

import { useMember, useUpdateOwnBio } from "../queries";
import { memberName, type MemberDetail } from "../types";

const BIO_MAX = 500;

function BioEditor({ member }: { member: MemberDetail }) {
  const update = useUpdateOwnBio();
  const [bio, setBio] = useState(member.bio);
  const tooLong = bio.length > BIO_MAX;

  return (
    <Stack
      component="form"
      spacing={2}
      aria-label="Edit your bio"
      onSubmit={(event) => {
        event.preventDefault();
        if (!tooLong) update.mutate(bio);
      }}
    >
      <FormAlert message={update.isError ? update.error.message : undefined} />
      <FormAlert
        severity="success"
        message={update.isSuccess ? "Your bio was saved." : undefined}
      />
      <TextField
        label="About you"
        multiline
        minRows={3}
        value={bio}
        onChange={(event) => {
          setBio(event.target.value);
        }}
        error={tooLong}
        helperText={`${bio.length}/${BIO_MAX}${tooLong ? " (too long)" : ""}`}
      />
      <div>
        <Button type="submit" variant="contained" disabled={update.isPending || tooLong}>
          Save bio
        </Button>
      </div>
    </Stack>
  );
}

/** MEM-03: a member's profile. Your own profile lets you edit your bio. */
export function MemberProfilePage() {
  const { publicId = "" } = useParams();
  const member = useMember(publicId);

  if (member.isPending) return <FullPageSpinner label="Loading member" />;
  if (member.isError) {
    if (isApiError(member.error) && member.error.status === 404) return <NotFoundPage />;
    return (
      <ErrorState message="We couldn't load this member." onRetry={() => void member.refetch()} />
    );
  }

  const data = member.data;
  return (
    <Stack spacing={3} sx={{ py: 4, maxWidth: 720 }}>
      <Link component={RouterLink} to="/app/members">
        ← All members
      </Link>
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack spacing={2}>
          <div>
            <Typography variant="h4" component="h1">
              {memberName(data)}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Chip label={data.voice_section.name} />
              {data.is_self ? <Chip label="You" color="primary" variant="outlined" /> : null}
            </Stack>
          </div>
          {data.joined_choir_on ? (
            <Typography color="text.secondary">
              Member since {new Date(data.joined_choir_on).getFullYear()}
            </Typography>
          ) : null}
          {data.is_self ? null : (
            <div>
              <Button
                component={RouterLink}
                to={`/app/members/${data.public_id}/evaluate`}
                variant="contained"
              >
                Evaluate {data.display_name || data.first_name}
              </Button>
            </div>
          )}
          {data.is_self ? (
            <BioEditor member={data} />
          ) : (
            <Typography sx={{ whiteSpace: "pre-wrap" }}>{data.bio || "No bio yet."}</Typography>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
