import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
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
import { memberName, type MemberDetail, type PublicSelfEvaluation } from "../types";

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
        helperText={`${String(bio.length)}/${String(BIO_MAX)}${tooLong ? " (too long)" : ""}`}
      />
      <div>
        <Button type="submit" variant="contained" disabled={update.isPending || tooLong}>
          Save bio
        </Button>
      </div>
    </Stack>
  );
}

function PublicSelfEvaluationCard({
  selfEval,
  isSelf,
  memberPublicId,
  memberDisplayName,
}: {
  selfEval: PublicSelfEvaluation | null | undefined;
  isSelf: boolean;
  memberPublicId: string;
  memberDisplayName: string;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ sm: "center" }}
          spacing={1}
        >
          <div>
            <Typography variant="h6" component="h2">
              Public Self-Evaluation &amp; Comments
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Visible to all choir members ·{" "}
              {selfEval
                ? `${selfEval.cycle.name} (${new Date(selfEval.submitted_at).toLocaleDateString()})`
                : "Not submitted yet"}
            </Typography>
          </div>
          {isSelf ? (
            <Button
              component={RouterLink}
              to={
                selfEval
                  ? `/app/my-evaluations/${selfEval.public_id}`
                  : `/app/members/${memberPublicId}/evaluate`
              }
              variant={selfEval ? "outlined" : "contained"}
              size="small"
            >
              {selfEval ? "View / Edit self-evaluation" : "Evaluate yourself"}
            </Button>
          ) : null}
        </Stack>

        {!selfEval ? (
          <Typography color="text.secondary">
            {isSelf
              ? "You haven't posted a public self-evaluation yet. Click “Evaluate yourself” during an open evaluation period to share your self-ratings and comments with the choir."
              : `${memberDisplayName} hasn't posted a public self-evaluation yet.`}
          </Typography>
        ) : (
          <Stack spacing={2.5} divider={<Divider flexItem />}>
            <div>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Self-Ratings
              </Typography>
              <Stack component="dl" spacing={1} sx={{ m: 0 }}>
                {selfEval.ratings.map((r) => (
                  <Stack
                    key={r.criterion_version}
                    direction="row"
                    justifyContent="space-between"
                    sx={{ gap: 2 }}
                  >
                    <Typography component="dt" sx={{ fontWeight: 500 }}>
                      {r.criterion_name}
                    </Typography>
                    <Typography component="dd" color="text.secondary" sx={{ m: 0 }}>
                      {r.value === null
                        ? "Not rated"
                        : `${String(r.value)} / ${String(r.max_value)}${r.label ? ` — ${r.label}` : ""}`}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </div>

            {selfEval.comments.length > 0 ? (
              <Stack spacing={1.5}>
                <Typography variant="subtitle2">Self-Comments &amp; Reflections</Typography>
                {selfEval.comments.map((entry, idx) => (
                  <div key={entry.key}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                      {idx + 1}. {entry.label}
                    </Typography>
                    <Typography sx={{ whiteSpace: "pre-wrap", mt: 0.5 }}>{entry.body}</Typography>
                  </div>
                ))}
              </Stack>
            ) : null}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

/** MEM-03: a member's profile. Your own profile lets you edit your bio and self-evaluate; all members see public self-evaluations. */
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
  const shortName = data.display_name || data.first_name;
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
          <div>
            <Button
              component={RouterLink}
              to={`/app/members/${data.public_id}/evaluate`}
              variant="contained"
            >
              {data.is_self ? "Evaluate yourself" : `Evaluate ${shortName}`}
            </Button>
          </div>
          {data.is_self ? (
            <BioEditor member={data} />
          ) : (
            <Typography sx={{ whiteSpace: "pre-wrap" }}>{data.bio || "No bio yet."}</Typography>
          )}
        </Stack>
      </Paper>

      <PublicSelfEvaluationCard
        selfEval={data.self_evaluation}
        isSelf={data.is_self}
        memberPublicId={data.public_id}
        memberDisplayName={shortName}
      />
    </Stack>
  );
}
