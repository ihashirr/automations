import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Trash2 } from "lucide-react-native";
import { playSelectionHaptic } from "../lib/haptics";
import { palette, radii, spacing, typography } from "../constants/theme";
import { DraftImage } from "../types/shops";

type PhotoStripProps = {
  images: DraftImage[];
  onRemove: (index: number) => void;
};

export function PhotoStrip({ images, onRemove }: PhotoStripProps) {
  if (images.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>Attached Photos</Text>
        <Text style={styles.count}>{images.length}</Text>
      </View>
      <ScrollView
        horizontal
        contentContainerStyle={styles.scrollContent}
        showsHorizontalScrollIndicator={false}
      >
        {images.map((image, index) => (
          <View key={`${image.localUri}-${index}`} style={styles.frame}>
            <Image source={{ uri: image.localUri }} style={styles.image} />
            <Pressable
              accessibilityLabel="Remove photo"
              hitSlop={10}
              onPress={() => {
                void playSelectionHaptic();
                onRemove(index);
              }}
              style={styles.removeButton}
            >
              <Trash2 color={palette.white} size={16} />
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontSize: typography.label,
    fontWeight: "700",
    color: palette.ink,
  },
  count: {
    minWidth: 28,
    borderRadius: radii.pill,
    backgroundColor: palette.accentSoft,
    color: palette.accentStrong,
    fontSize: typography.label,
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    textAlign: "center",
  },
  scrollContent: {
    gap: spacing.sm,
  },
  frame: {
    width: 104,
    height: 104,
    borderRadius: radii.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surfaceStrong,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  removeButton: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(23, 23, 23, 0.72)",
  },
});
