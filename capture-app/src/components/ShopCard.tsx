import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { MessageCircleMore, Navigation, Phone } from "lucide-react-native";
import { getVisitOutcomeLabel, VisitOutcomeValue } from "../constants/visit-outcomes";
import { buildDialLink, buildWhatsAppLink, formatCaptureTime, getInitials } from "../lib/format";
import { buildCloudinaryImageUrl } from "../lib/cloudinary";
import { getLocationAreaLabel } from "../lib/location";
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
  outcome: VisitOutcomeValue;
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
  outcome,
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
    neighborhood?.trim() || getLocationAreaLabel(location)?.split(",")[0]?.trim() || "Unknown area";

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
    <View style={styles.contentWrap}>
      <View style={styles.heroRow}>
        {resolvedPreviewImageUrl ? (
          <Image source={{ uri: resolvedPreviewImageUrl }} style={styles.previewImage} />
        ) : (
          <View style={styles.previewFallback}>
            <Text style={styles.previewInitials}>{getInitials(name)}</Text>
          </View>
        )}

        <View style={styles.mainInfo}>
          <View style={styles.titleRow}>
            <Text numberOfLines={1} style={styles.name}>
              {name}
            </Text>
            {distanceLabel ? (
              <View style={styles.distancePill}>
                <Text style={styles.distanceText}>{distanceLabel}</Text>
              </View>
            ) : null}
          </View>

          <Text numberOfLines={1} style={styles.subtext}>
            {contactPerson || "No decision maker"} • {neighborhoodLabel}
          </Text>

          <View style={styles.metaRow}>
            <View style={styles.outcomePill}>
              <Text style={styles.outcomeText}>{getVisitOutcomeLabel(outcome)}</Text>
            </View>
            <Text style={styles.timestamp}>{formatCaptureTime(createdAt)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.utilityRow}>
        <Pressable
          disabled={!hasPhone}
          onPress={(event) => {
            event.stopPropagation();
            void playSelectionHaptic();
            void handleCall();
          }}
          style={({ pressed }) => [styles.ghostAction, pressed && styles.ghostActionPressed]}
        >
          <Phone color={hasPhone ? palette.ink : palette.mutedInk} size={18} strokeWidth={2} />
        </Pressable>
        <Pressable
          disabled={!hasPhone}
          onPress={(event) => {
            event.stopPropagation();
            void playSelectionHaptic();
            void handleWhatsApp();
          }}
          style={({ pressed }) => [styles.ghostAction, pressed && styles.ghostActionPressed]}
        >
          <MessageCircleMore
            color={hasPhone ? palette.ink : palette.mutedInk}
            size={18}
            strokeWidth={2}
          />
        </Pressable>
        <Pressable
          disabled={!location}
          onPress={(event) => {
            event.stopPropagation();
            void playSelectionHaptic();
            void handleMapPin();
          }}
          style={({ pressed }) => [styles.ghostAction, pressed && styles.ghostActionPressed]}
        >
          <Navigation color={location ? palette.ink : palette.mutedInk} size={18} strokeWidth={2} />
        </Pressable>
        <View style={styles.flexSpacer} />
        <View style={[styles.statusPill, statusTone === "queued" && styles.statusPillQueued]}>
          <Text style={[styles.statusPillText, statusTone === "queued" && styles.statusPillTextQueued]}>
            {statusLabel}
          </Text>
        </View>
        <View
          style={[styles.statusDot, statusTone === "queued" && styles.statusDotQueued]}
        />
      </View>
    </View>
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
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
    shadowColor: "#18161D",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 6,
    overflow: "hidden",
  },
  cardPressed: {
    backgroundColor: "#FFF4EC",
  },
  cardQueued: {
    borderColor: "#EDB497",
    backgroundColor: "#FFF8F3",
  },
  contentWrap: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  heroRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
  },
  previewImage: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: palette.surfaceStrong,
  },
  previewFallback: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.hero,
  },
  previewInitials: {
    fontSize: 22,
    fontWeight: "900",
    color: palette.white,
    letterSpacing: 0.5,
  },
  mainInfo: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  name: {
    flex: 1,
    fontSize: 17,
    fontWeight: "800",
    color: palette.ink,
  },
  distancePill: {
    backgroundColor: palette.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: "800",
    color: palette.accentStrong,
    textTransform: "uppercase",
  },
  subtext: {
    fontSize: 14,
    color: palette.mutedInk,
    fontWeight: "600",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginTop: spacing.xxs,
  },
  outcomePill: {
    borderRadius: radii.pill,
    backgroundColor: palette.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  outcomeText: {
    fontSize: 10,
    fontWeight: "800",
    color: palette.accentStrong,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  timestamp: {
    fontSize: 11,
    fontWeight: "700",
    color: palette.mutedInk,
  },
  utilityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  ghostAction: {
    padding: 2,
  },
  ghostActionPressed: {
    opacity: 0.5,
  },
  flexSpacer: {
    flex: 1,
  },
  statusPill: {
    borderRadius: radii.pill,
    backgroundColor: palette.successSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  statusPillQueued: {
    backgroundColor: palette.warningSoft,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: palette.success,
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  statusPillTextQueued: {
    color: palette.warning,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.success,
  },
  statusDotQueued: {
    backgroundColor: palette.warning,
  },
});
