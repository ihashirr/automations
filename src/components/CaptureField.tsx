import { forwardRef } from "react";
import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { palette, radii, spacing, typography } from "../constants/theme";

type CaptureFieldProps = TextInputProps & {
  label: string;
};

export const CaptureField = forwardRef<TextInput, CaptureFieldProps>(function CaptureField(
  { label, style, ...textInputProps },
  ref,
) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        placeholderTextColor={palette.mutedInk}
        style={[styles.input, style]}
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
});
