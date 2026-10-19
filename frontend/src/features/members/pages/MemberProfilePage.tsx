import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import SvgIcon from "@mui/material/SvgIcon";
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
  const [isOfficer, setIsOfficer] = useState(Boolean(member.is_officer));
  const [officerPosition, setOfficerPosition] = useState(member.officer_position ?? "");
  const tooLong = bio.length > BIO_MAX;
  const missingPosition = isOfficer && !officerPosition.trim();

  return (
    <Stack
      component="form"
      spacing={2}
      aria-label="Edit your bio"
      onSubmit={(event) => {
        event.preventDefault();
        if (!tooLong && !missingPosition) {
          update.mutate({
            bio,
            is_officer: isOfficer,
            officer_position: isOfficer ? officerPosition.trim() : "",
          });
        }
      }}
    >
      <FormAlert message={update.isError ? update.error.message : undefined} />
      <FormAlert
        severity="success"
        message={update.isSuccess ? "Your profile was saved." : undefined}
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={isOfficer}
            onChange={(e) => {
              const checked = e.target.checked;
              setIsOfficer(checked);
              if (!checked) setOfficerPosition("");
            }}
          />
        }
        label="I am an officer of the choir"
      />
      {isOfficer ? (
        <TextField
          label="Officer position"
          placeholder="e.g. President, Vice President, Secretary, Section Leader"
          value={officerPosition}
          onChange={(e) => {
            setOfficerPosition(e.target.value);
          }}
          error={missingPosition}
          helperText={
            missingPosition
              ? "Enter the position you handle in the choir."
              : "Your position in the choir."
          }
          slotProps={{ htmlInput: { maxLength: 100 } }}
        />
      ) : null}
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
        <Button
          type="submit"
          variant="contained"
          disabled={update.isPending || tooLong || missingPosition}
        >
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
          sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
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
                    sx={{ justifyContent: "space-between", gap: 2 }}
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
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", gap: 0.5 }}>
              <Chip label={data.voice_section.name} />
              {data.is_officer ? (
                <Chip
                  color="secondary"
                  label={data.officer_position ? `Officer: ${data.officer_position}` : "Choir Officer"}
                />
              ) : null}
              {data.is_self ? <Chip label="You" color="primary" variant="outlined" /> : null}
              {data.is_evaluated ? (
                <Chip
                  label="Evaluated"
                  color="success"
                  icon={
                    <SvgIcon fontSize="small" sx={{ "&&": { color: "inherit" } }}>
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </SvgIcon>
                  }
                  sx={{
                    fontWeight: 700,
                    "& .MuiChip-icon": { color: "inherit" },
                  }}
                />
              ) : null}
            </Stack>
          </div>
          {data.joined_choir_on ? (
            <Typography color="text.secondary">
              Member since {new Date(data.joined_choir_on).getFullYear()}
            </Typography>
          ) : null}
          <div>
            {data.is_evaluated ? (
              <Button
                component={RouterLink}
                to={
                  data.evaluation_id
                    ? `/app/my-evaluations/${data.evaluation_id}`
                    : `/app/members/${data.public_id}/evaluate`
                }
                variant="outlined"
                color="success"
                startIcon={
                  <SvgIcon fontSize="small">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </SvgIcon>
                }
              >
                {data.is_self ? "View self-evaluation" : `View evaluation of ${shortName}`}
              </Button>
            ) : (
              <Button
                component={RouterLink}
                to={`/app/members/${data.public_id}/evaluate`}
                variant="contained"
              >
                {data.is_self ? "Evaluate yourself" : `Evaluate ${shortName}`}
              </Button>
            )}
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
