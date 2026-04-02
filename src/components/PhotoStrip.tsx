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
      <View style={styles.headerRow}>
        <Text style={styles.label}>Review Images</Text>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{images.length}</Text>
        </View>
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontSize: typography.overline,
    fontWeight: "800",
    color: palette.mutedInk,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  scrollContent: {
    gap: spacing.xs,
    paddingRight: spacing.xs,
  },
  countPill: {
    minWidth: 34,
    height: 34,
    borderRadius: radii.pill,
    backgroundColor: palette.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: {
    fontSize: typography.label,
    fontWeight: "700",
    color: palette.accentStrong,
  },
  frame: {
    width: 78,
    height: 78,
    borderRadius: radii.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  removeButton: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(23, 23, 23, 0.72)",
  },
});
