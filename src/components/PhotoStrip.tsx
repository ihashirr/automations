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
      <ScrollView
        horizontal
        contentContainerStyle={styles.scrollContent}
        showsHorizontalScrollIndicator={false}
      >
        <View style={styles.countPill}>
          <Text style={styles.countText}>{images.length}</Text>
        </View>
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
    minHeight: 72,
  },
  scrollContent: {
    gap: spacing.xs,
    alignItems: "center",
  },
  countPill: {
    minWidth: 32,
    height: 32,
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
    width: 68,
    height: 68,
    borderRadius: radii.sm,
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
