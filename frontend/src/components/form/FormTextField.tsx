import TextField, { type TextFieldProps } from "@mui/material/TextField";
import { useController, type Control, type FieldValues, type Path } from "react-hook-form";

type FormTextFieldProps<T extends FieldValues> = Omit<
  TextFieldProps,
  "name" | "value" | "onChange" | "onBlur" | "error"
> & {
  name: Path<T>;
  control: Control<T>;
};

/** MUI TextField bound to React Hook Form, with accessible error text. */
export function FormTextField<T extends FieldValues>({
  name,
  control,
  helperText,
  ...props
}: FormTextFieldProps<T>) {
  const { field, fieldState } = useController({ name, control });
  return (
    <TextField
      {...props}
      name={field.name}
      value={field.value ?? ""}
      onChange={field.onChange}
      onBlur={field.onBlur}
      inputRef={field.ref}
      error={Boolean(fieldState.error)}
      helperText={fieldState.error?.message ?? helperText}
      fullWidth
    />
  );
}
