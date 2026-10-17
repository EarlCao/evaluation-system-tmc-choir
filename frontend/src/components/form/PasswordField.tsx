import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import { useState } from "react";
import type { Control, FieldValues, Path } from "react-hook-form";

import { FormTextField } from "./FormTextField";

interface PasswordFieldProps<T extends FieldValues> {
  name: Path<T>;
  control: Control<T>;
  label: string;
  autoComplete: "current-password" | "new-password";
  helperText?: string;
}

export function PasswordField<T extends FieldValues>({
  name,
  control,
  label,
  autoComplete,
  helperText,
}: PasswordFieldProps<T>) {
  const [visible, setVisible] = useState(false);
  return (
    <FormTextField
      name={name}
      control={control}
      label={label}
      type={visible ? "text" : "password"}
      autoComplete={autoComplete}
      helperText={helperText}
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <Button
                size="small"
                onClick={() => {
                  setVisible((v) => !v);
                }}
                aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
              >
                {visible ? "Hide" : "Show"}
              </Button>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
