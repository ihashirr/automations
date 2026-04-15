import { Component, ReactNode } from "react";
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { palette, radii, spacing, typography } from "../constants/theme";

type ScreenErrorBoundaryProps = {
  body: string;
  children: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  resetKeys?: unknown[];
  title: string;
  tone?: "light" | "dark";
};

type ScreenErrorBoundaryState = {
  error: Error | null;
};

function areResetKeysEqual(left: unknown[] = [], right: unknown[] = []) {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (!Object.is(left[index], right[index])) {
      return false;
    }
  }

  return true;
}

function getErrorPreview(error: Error | null) {
  if (!error?.message) {
    return null;
  }

  const [firstLine] = error.message.split("\n");
  const preview = firstLine.trim();
  return preview || null;
}

export class ScreenErrorBoundary extends Component<
  ScreenErrorBoundaryProps,
  ScreenErrorBoundaryState
> {
  state: ScreenErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): ScreenErrorBoundaryState {
    return { error };
  }

  componentDidUpdate(prevProps: ScreenErrorBoundaryProps) {
    if (
      this.state.error &&
      !areResetKeysEqual(prevProps.resetKeys, this.props.resetKeys)
    ) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const isDarkTone = this.props.tone === "dark";
    const errorPreview = getErrorPreview(this.state.error);

    return (
      <View
        style={[
          styles.screen,
          isDarkTone ? styles.screenDark : styles.screenLight,
          this.props.containerStyle,
        ]}
      >
        <View style={[styles.card, isDarkTone ? styles.cardDark : styles.cardLight]}>
          <Text style={[styles.eyebrow, isDarkTone && styles.eyebrowDark]}>
            View Unavailable
          </Text>
          <Text style={[styles.title, isDarkTone && styles.titleDark]}>
            {this.props.title}
          </Text>
          <Text style={[styles.body, isDarkTone && styles.bodyDark]}>
            {this.props.body}
          </Text>
          {errorPreview ? (
            <Text style={[styles.debug, isDarkTone && styles.debugDark]} numberOfLines={4}>
              {errorPreview}
            </Text>
          ) : null}
          <Pressable
            onPress={() => this.setState({ error: null })}
            style={({ pressed }) => [
              styles.button,
              isDarkTone ? styles.buttonDark : styles.buttonLight,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.buttonText}>Retry View</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  body: {
    fontSize: typography.body,
    lineHeight: 24,
    color: palette.mutedInk,
  },
  bodyDark: {
    color: "#D7D0C4",
  },
  button: {
    minHeight: 48,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  buttonDark: {
    backgroundColor: palette.accent,
  },
  buttonLight: {
    backgroundColor: palette.accent,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonText: {
    fontSize: typography.body,
    fontWeight: "800",
    color: palette.white,
  },
  card: {
    borderRadius: radii.lg,
    padding: spacing.xl,
    gap: spacing.sm,
    borderWidth: 1,
  },
  cardDark: {
    backgroundColor: "#1C1D1F",
    borderColor: "rgba(255,255,255,0.08)",
  },
  cardLight: {
    backgroundColor: palette.card,
    borderColor: palette.line,
  },
  debug: {
    fontSize: typography.label,
    color: palette.mutedInk,
  },
  debugDark: {
    color: "#AFA79A",
  },
  eyebrow: {
    fontSize: typography.overline,
    fontWeight: "800",
    color: palette.accentStrong,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  eyebrowDark: {
    color: "#F2A27E",
  },
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  screenDark: {
    backgroundColor: "#161719",
  },
  screenLight: {
    backgroundColor: palette.background,
  },
  title: {
    fontSize: typography.title,
    fontWeight: "800",
    color: palette.ink,
  },
  titleDark: {
    color: palette.white,
  },
});
