import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight, MapPin, MessageCircleMore, Phone, UserRound } from "lucide-react-native";
import { buildDialLink, buildWhatsAppLink, formatCaptureTime, getInitials } from "../lib/format";
import { buildCloudinaryImageUrl } from "../lib/cloudinary";
import { openLocationInMaps } from "../lib/maps";
import { CapturedLocation } from "../types/shops";
import { playSelectionHaptic } from "../lib/haptics";
import { palette, radii, spacing, typography } from "../constants/theme";

type ShopCardProps = {
  contactPerson: string;
  createdAt: number;
  distanceLabel?: string | null;
  location: CapturedLocation | null;
  name: string;
  onLongPress?: () => void;
  phone: string;
  previewImageUrl: string | null;
  neighborhood?: string | null;
  statusLabel: string;
  statusTone: "live" | "queued";
  onPress?: () => void;
};

export function ShopCard({
  contactPerson,
  createdAt,
  distanceLabel,
  location,
  name,
  onLongPress,
  onPress,
  phone,
  previewImageUrl,
  neighborhood,
  statusLabel,
  statusTone,
}: ShopCardProps) {
  const resolvedPreviewImageUrl = previewImageUrl
    ? buildCloudinaryImageUrl(previewImageUrl, { width: 160, height: 160 })
    : null;
  const hasPhone = phone.trim().length > 0;
  const neighborhoodLabel =
    neighborhood?.trim() || location?.formattedAddress?.split(",")[0]?.trim() || "Unknown area";

  async function handleCall() {
    if (!hasPhone) {
      return;
    }

    await Linking.openURL(buildDialLink(phone));
  }

  async function handleWhatsApp() {
    const whatsappLink = buildWhatsAppLink(phone);

    if (!whatsappLink) {
      return;
    }

    await Linking.openURL(whatsappLink);
  }

  async function handleMapPin() {
    if (!location) {
      return;
    }

    await openLocationInMaps(location);
  }

  const content = (
    <>
      <View style={styles.media}>
        {resolvedPreviewImageUrl ? (
          <Image source={{ uri: resolvedPreviewImageUrl }} style={styles.image} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>{getInitials(name)}</Text>
          </View>
        )}
      </View>

      <View style={styles.copy}>
        <View style={styles.topRow}>
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.badge,
                statusTone === "queued" ? styles.badgeQueued : styles.badgeLive,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  statusTone === "queued" ? styles.badgeTextQueued : styles.badgeTextLive,
                ]}
              >
                {statusLabel}
              </Text>
            </View>
            {distanceLabel ? <Text style={styles.distance}>{distanceLabel}</Text> : null}
          </View>
          {onPress ? <ChevronRight color={palette.mutedInk} size={18} /> : null}
        </View>
        <Text numberOfLines={2} style={styles.name}>
          {name}
        </Text>

        <View style={styles.metaRow}>
          <UserRound color={palette.mutedInk} size={14} />
          <Text numberOfLines={1} style={styles.meta}>
            {contactPerson || "Manager unknown"}
          </Text>
        </View>
        <View style={styles.neighborhoodTag}>
          <MapPin color={palette.accentStrong} size={13} />
          <Text numberOfLines={1} style={styles.neighborhoodTagText}>
            {neighborhoodLabel}
          </Text>
        </View>
        <View style={styles.footer}>
          <Text style={styles.footerTime}>{formatCaptureTime(createdAt)}</Text>
        </View>
        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Call ${name}`}
            disabled={!hasPhone}
            onPress={(event) => {
              event.stopPropagation();
              void playSelectionHaptic();
              void handleCall();
            }}
            style={({ pressed }) => [
              styles.actionButton,
              !hasPhone && styles.actionButtonDisabled,
              pressed && hasPhone && styles.actionButtonPressed,
            ]}
          >
            <Phone color={hasPhone ? palette.ink : palette.mutedInk} size={16} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open map for ${name}`}
            disabled={!location}
            onPress={(event) => {
              event.stopPropagation();
              void playSelectionHaptic();
              void handleMapPin();
            }}
            style={({ pressed }) => [
              styles.actionButton,
              !location && styles.actionButtonDisabled,
              pressed && Boolean(location) && styles.actionButtonPressed,
            ]}
          >
            <MapPin color={location ? palette.ink : palette.mutedInk} size={16} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`WhatsApp ${name}`}
            disabled={!hasPhone}
            onPress={(event) => {
              event.stopPropagation();
              void playSelectionHaptic();
              void handleWhatsApp();
            }}
            style={({ pressed }) => [
              styles.actionButton,
              !hasPhone && styles.actionButtonDisabled,
              pressed && hasPhone && styles.actionButtonPressed,
            ]}
          >
            <MessageCircleMore color={hasPhone ? palette.ink : palette.mutedInk} size={16} />
          </Pressable>
        </View>
      </View>
    </>
  );

  if (!onPress && !onLongPress) {
    return <View style={[styles.card, statusTone === "queued" && styles.cardQueued]}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open details for ${name}`}
      onLongPress={() => {
        void playSelectionHaptic();
        onLongPress?.();
      }}
      onPress={() => {
        void playSelectionHaptic();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.card,
        statusTone === "queued" && styles.cardQueued,
        pressed && styles.cardPressed,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#E0DBCF",
    backgroundColor: palette.card,
    padding: spacing.sm,
    shadowColor: "#1C1C1E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
  },
  cardQueued: {
    borderColor: "#F1B08F",
    backgroundColor: "#FFF8F2",
  },
  media: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
    overflow: "hidden",
    backgroundColor: palette.surfaceStrong,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.accentSoft,
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: "700",
    color: palette.accentStrong,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexWrap: "wrap",
  },
  name: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  meta: {
    fontSize: 13,
    color: palette.mutedInk,
    flex: 1,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  neighborhoodTag: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "#F1B08F",
    backgroundColor: "#FFF8F2",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  neighborhoodTagText: {
    maxWidth: 180,
    fontSize: 11,
    fontWeight: "700",
    color: palette.accentStrong,
    letterSpacing: 0.2,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  footerTime: {
    fontSize: 10,
    color: palette.mutedInk,
    fontWeight: "700",
  },
  distance: {
    fontSize: 11,
    fontWeight: "800",
    color: palette.accentStrong,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  badge: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  badgeLive: {
    backgroundColor: palette.successSoft,
  },
  badgeQueued: {
    backgroundColor: "#FDE7DA",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  badgeTextLive: {
    color: palette.success,
  },
  badgeTextQueued: {
    color: palette.accentStrong,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: 2,
  },
  actionButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonPressed: {
    opacity: 0.65,
  },
  actionButtonDisabled: {
    opacity: 0.45,
  },
});
