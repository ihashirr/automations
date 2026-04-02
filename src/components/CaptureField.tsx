import { forwardRef, useState } from "react";
import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { palette, radii, spacing, typography } from "../constants/theme";

type CaptureFieldProps = TextInputProps & {
  label: string;
};

export const CaptureField = forwardRef<TextInput, CaptureFieldProps>(function CaptureField(
  { label, onBlur, onFocus, style, ...textInputProps },
  ref,
) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        onBlur={(event) => {
          setIsFocused(false);
          onBlur?.(event);
        }}
        onFocus={(event) => {
          setIsFocused(true);
          onFocus?.(event);
        }}
        placeholderTextColor={palette.mutedInk}
        style={[styles.input, isFocused && styles.inputFocused, style]}
        {...textInputProps}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.overline,
    fontWeight: "700",
    color: palette.mutedInk,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  input: {
    minHeight: 56,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.body,
    color: palette.ink,
  },
  inputFocused: {
    borderColor: "#3B82F6",
  },
});
