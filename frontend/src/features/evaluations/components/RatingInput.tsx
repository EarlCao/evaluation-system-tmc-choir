import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import FormLabel from "@mui/material/FormLabel";
import Slider from "@mui/material/Slider";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { useId } from "react";

import { pointKey, scalePoints, type FormCriterion } from "../types";

const MAX_BUTTONS = 11;

interface RatingInputProps {
  criterion: FormCriterion;
  value: number | null;
  onChange: (value: number | null) => void;
  error?: string | undefined;
}

/**
 * One criterion's rating (EVAL-03/04). Short scales are a group of buttons, long or
 * percentage scales a slider. Labels such as "5 = Excellent" are shown for the chosen value.
 */
export function RatingInput({ criterion, value, onChange, error }: RatingInputProps) {
  const id = useId();
  const points = scalePoints(criterion);
  const useButtons = criterion.scale_type === "NUMERIC" && points.length <= MAX_BUTTONS;
  const chosenLabel = value === null ? null : criterion.labels[pointKey(value)];
  const helperId = `${id}-helper`;

  return (
    <FormControl component="fieldset" error={Boolean(error)} fullWidth>
      <FormLabel
        component="legend"
        id={`${id}-label`}
        sx={{ fontWeight: 600, color: "text.primary" }}
      >
        {criterion.name}
        {criterion.is_required ? "" : " (optional)"}
      </FormLabel>
      {criterion.description ? (
        <Typography variant="body2" color="text.secondary">
          {criterion.description}
        </Typography>
      ) : null}
      {Object.keys(criterion.labels).length > 0 ? (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 0.5, fontStyle: "italic" }}
        >
          Scale reference:{" "}
          {Object.entries(criterion.labels)
            .map(([k, v]) => `${k} = ${v}`)
            .join(" · ")}
        </Typography>
      ) : null}

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{ mt: 1, alignItems: { sm: "center" } }}
      >
        {useButtons ? (
          <ToggleButtonGroup
            exclusive
            value={value}
            onChange={(_, next: number | null) => {
              if (next !== null) onChange(next);
            }}
            aria-label={`${criterion.name} rating`}
            aria-describedby={helperId}
            size="small"
            sx={{ flexWrap: "wrap" }}
          >
            {points.map((p) => {
              const label = criterion.labels[pointKey(p)];
              return (
                <ToggleButton
                  key={p}
                  value={p}
                  aria-label={label ? `${pointKey(p)}: ${label}` : pointKey(p)}
                  sx={{ minWidth: 44 }}
                >
                  {pointKey(p)}
                </ToggleButton>
              );
            })}
          </ToggleButtonGroup>
        ) : (
          <Slider
            value={value ?? criterion.min_value}
            min={criterion.min_value}
            max={criterion.max_value}
            step={criterion.step}
            valueLabelDisplay="auto"
            marks={[
              { value: criterion.min_value, label: pointKey(criterion.min_value) },
              { value: criterion.max_value, label: pointKey(criterion.max_value) },
            ]}
            onChange={(_, next) => {
              onChange(next);
            }}
            aria-labelledby={`${id}-label`}
            aria-describedby={helperId}
            sx={{ maxWidth: 420, mx: 1 }}
          />
        )}
        {!criterion.is_required && value !== null ? (
          <Button
            size="small"
            onClick={() => {
              onChange(null);
            }}
          >
            Clear
          </Button>
        ) : null}
      </Stack>

      <FormHelperText id={helperId} aria-live="polite">
        {error ??
          (value === null
            ? criterion.is_required
              ? "Choose a rating."
              : "You can skip this one."
            : `You chose ${pointKey(value)}${chosenLabel ? ` (${chosenLabel})` : ""}.`)}
      </FormHelperText>
    </FormControl>
  );
}
