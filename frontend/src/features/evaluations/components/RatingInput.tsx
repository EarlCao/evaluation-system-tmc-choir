import Box from "@mui/material/Box";
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
 * One criterion's rating (EVAL-03/04). Styled like a Google Forms Linear Scale question card.
 * Displays numbers with radio circles, scale endpoints, and selection feedback.
 */
export function RatingInput({ criterion, value, onChange, error }: RatingInputProps) {
  const id = useId();
  const points = scalePoints(criterion);
  const useButtons = criterion.scale_type === "NUMERIC" && points.length <= MAX_BUTTONS;
  const chosenLabel = value === null ? null : criterion.labels[pointKey(value)];
  const helperId = `${id}-helper`;

  const minLabel = criterion.labels[pointKey(criterion.min_value)];
  const maxLabel = criterion.labels[pointKey(criterion.max_value)];

  return (
    <FormControl
      component="fieldset"
      error={Boolean(error)}
      fullWidth
      sx={{
        p: { xs: 2, sm: 2.5 },
        borderRadius: 2,
        border: "1px solid",
        borderColor: error ? "error.main" : "divider",
        borderLeft: (theme) =>
          error
            ? `4px solid ${theme.palette.error.main}`
            : value !== null
              ? `4px solid ${theme.palette.mode === "dark" ? "#d4af37" : "#1e1b4b"}`
              : "1px solid",
        borderLeftColor: error
          ? "error.main"
          : value !== null
            ? (theme) => (theme.palette.mode === "dark" ? "#d4af37" : "#1e1b4b")
            : "divider",
        bgcolor: "background.paper",
        boxShadow: value !== null ? "0 2px 8px rgba(0,0,0,0.04)" : "none",
        transition: "all 0.2s ease-in-out",
      }}
    >
      <FormLabel
        component="legend"
        id={`${id}-label`}
        sx={{
          fontWeight: 700,
          fontSize: "1.05rem",
          color: "text.primary",
        }}
      >
        {criterion.name}
        {criterion.is_required ? "" : " (optional)"}
      </FormLabel>
      {criterion.description ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
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

      <Box sx={{ mt: 2, width: "100%" }}>
        {useButtons ? (
          <Box sx={{ maxWidth: 520, width: "100%" }}>
            {/* Google Forms linear scale row */}
            <ToggleButtonGroup
              exclusive
              value={value}
              onChange={(_, next: number | null) => {
                if (next !== null) onChange(next);
              }}
              aria-label={`${criterion.name} rating`}
              aria-describedby={helperId}
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
                border: "none",
                gap: { xs: 0.5, sm: 1 },
                bgcolor: (theme) =>
                  theme.palette.mode === "dark"
                    ? "rgba(255, 255, 255, 0.02)"
                    : "rgba(0, 0, 0, 0.015)",
                p: { xs: 1, sm: 1.5 },
                borderRadius: 2,
                "& .MuiToggleButtonGroup-grouped": {
                  border: "none !important",
                  borderRadius: "12px !important",
                },
              }}
            >
              {points.map((p) => {
                const isSelected = value === p;
                const label = criterion.labels[pointKey(p)];
                return (
                  <ToggleButton
                    key={p}
                    value={p}
                    aria-label={label ? `${pointKey(p)}: ${label}` : pointKey(p)}
                    sx={{
                      flex: 1,
                      minWidth: { xs: 44, sm: 54 },
                      py: 1,
                      px: { xs: 0.5, sm: 1 },
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 0.75,
                      color: isSelected ? "primary.main" : "text.primary",
                      bgcolor: isSelected
                        ? (theme) =>
                            theme.palette.mode === "dark"
                              ? "rgba(212, 175, 55, 0.15)"
                              : "rgba(30, 27, 75, 0.08)"
                        : "transparent",
                      "&:hover": {
                        bgcolor: isSelected
                          ? (theme) =>
                              theme.palette.mode === "dark"
                                ? "rgba(212, 175, 55, 0.22)"
                                : "rgba(30, 27, 75, 0.12)"
                          : "action.hover",
                      },
                      transition: "all 0.15s ease-in-out",
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: isSelected ? 800 : 600,
                        fontSize: { xs: "0.95rem", sm: "1.05rem" },
                        color: isSelected ? "primary.main" : "text.primary",
                      }}
                    >
                      {pointKey(p)}
                    </Typography>
                    <Box
                      sx={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        border: "2px solid",
                        borderColor: isSelected ? "primary.main" : "text.secondary",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: isSelected
                          ? (theme) =>
                              theme.palette.mode === "dark"
                                ? "rgba(212, 175, 55, 0.2)"
                                : "rgba(30, 27, 75, 0.1)"
                          : "transparent",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {isSelected ? (
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            bgcolor: "primary.main",
                          }}
                        />
                      ) : null}
                    </Box>
                  </ToggleButton>
                );
              })}
            </ToggleButtonGroup>

            {/* End labels flanking the scale (Google Forms style) */}
            {minLabel || maxLabel ? (
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  width: "100%",
                  px: 1,
                  mt: 0.75,
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontWeight: 600, maxWidth: { xs: 120, sm: 180 } }}
                >
                  {minLabel ?? ""}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    fontWeight: 600,
                    maxWidth: { xs: 120, sm: 180 },
                    textAlign: "right",
                  }}
                >
                  {maxLabel ?? ""}
                </Typography>
              </Box>
            ) : null}
          </Box>
        ) : (
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{ alignItems: { sm: "center" } }}
          >
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
          </Stack>
        )}
      </Box>

      <Stack
        direction="row"
        spacing={2}
        sx={{
          mt: 1.5,
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <FormHelperText id={helperId} aria-live="polite" sx={{ m: 0 }}>
          {error ??
            (value === null
              ? criterion.is_required
                ? "Choose a rating."
                : "You can skip this one."
              : `You chose ${pointKey(value)}${chosenLabel ? ` (${chosenLabel})` : ""}.`)}
        </FormHelperText>

        {value !== null ? (
          <Button
            size="small"
            color="inherit"
            onClick={() => {
              onChange(null);
            }}
            sx={{
              textTransform: "none",
              fontSize: "0.78rem",
              color: "text.secondary",
              "&:hover": { color: "text.primary" },
            }}
          >
            Clear selection
          </Button>
        ) : null}
      </Stack>
    </FormControl>
  );
}
