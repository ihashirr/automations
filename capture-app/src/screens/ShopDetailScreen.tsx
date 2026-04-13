import { useQuery } from "convex/react";
import { useEffect } from "react";
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MapPin, MessageCircleMore, Phone } from "lucide-react-native";
import { api } from "../../convex/_generated/api";
import { getVisitOutcomeLabel } from "../constants/visit-outcomes";
import { palette, radii, spacing, typography } from "../constants/theme";
import { buildCloudinaryImageUrl } from "../lib/cloudinary";
import {
  buildDialLink,
  buildWhatsAppLink,
  formatCaptureTime,
  formatCoordinates,
} from "../lib/format";
import { playSelectionHaptic } from "../lib/haptics";
import { getLocationLabel } from "../lib/location";
import { openLocationInMaps } from "../lib/maps";
import { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "ShopDetail">;

export function ShopDetailScreen({ navigation, route }: Props) {
  const shop = useQuery(api.shops.getShop, {
    shopId: route.params.shopId,
  });

  useEffect(() => {
    if (shop?.name) {
      navigation.setOptions({
        title: shop.name,
      });
    }
  }, [navigation, shop?.name]);

  if (shop === undefined) {
    return (
      <View style={styles.centerState}>
        <Text style={styles.centerTitle}>Loading lead...</Text>
      </View>
    );
  }

  if (shop === null) {
    return (
      <View style={styles.centerState}>
        <Text style={styles.centerTitle}>Lead not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.container}>
      <View style={styles.heroCard}>
        {shop.images[0] ? (
          <Image
            source={{ uri: buildCloudinaryImageUrl(shop.images[0], { width: 1200 }) }}
            style={styles.heroImage}
          />
        ) : (
          <View style={styles.heroPlaceholder}>
            <Text style={styles.heroPlaceholderText}>{shop.name}</Text>
          </View>
        )}

        <View style={styles.heroCopy}>
          <Text style={styles.name}>{shop.name}</Text>
          <Text style={styles.meta}>{shop.contactPerson || "No contact person saved"}</Text>
          <Text style={styles.meta}>{shop.phone || "No phone number saved"}</Text>
          <Text style={styles.meta}>
            {shop.referredBy ? `Referred by ${shop.referredBy}` : "Direct capture"}
          </Text>
          <View style={styles.outcomePill}>
            <Text style={styles.outcomePillText}>{getVisitOutcomeLabel(shop.outcome)}</Text>
          </View>
          <Text style={styles.timestamp}>Captured {formatCaptureTime(shop.createdAt)}</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        {shop.phone ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Call ${shop.phone}`}
            onPress={() => {
              void playSelectionHaptic();
              void Linking.openURL(buildDialLink(shop.phone));
            }}
            style={({ pressed }) => [styles.primaryAction, pressed && styles.primaryActionPressed]}
          >
            <Phone color={palette.white} size={18} />
            <Text style={styles.primaryActionText}>Call</Text>
          </Pressable>
        ) : null}

        {shop.phone ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open WhatsApp for ${shop.phone}`}
            onPress={() => {
              void playSelectionHaptic();
              const whatsappLink = buildWhatsAppLink(shop.phone);

              if (whatsappLink) {
                void Linking.openURL(whatsappLink);
              }
            }}
            style={({ pressed }) => [styles.secondaryAction, pressed && styles.secondaryActionPressed]}
          >
            <MessageCircleMore color={palette.ink} size={18} />
            <Text style={styles.secondaryActionText}>WhatsApp</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Locked Location</Text>
        {shop.location ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open map for ${shop.name}`}
            onPress={() => {
              void playSelectionHaptic();
              const location = shop.location;

              if (location) {
                void openLocationInMaps(location);
              }
            }}
            style={({ pressed }) => [styles.detailCard, pressed && styles.locationPressed]}
          >
            <View style={styles.detailRowInline}>
              <MapPin color={palette.accent} size={16} />
              <Text style={styles.detailValue}>{getLocationLabel(shop.location)}</Text>
            </View>
            <Text style={styles.coordinateText}>{formatCoordinates(shop.location)}</Text>
            <Text style={styles.locationHint}>View in Google Maps</Text>
          </Pressable>
        ) : (
          <View style={styles.detailCard}>
            <View style={styles.detailRowInline}>
              <MapPin color={palette.accent} size={16} />
              <Text style={styles.detailValue}>No pinned location saved</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Photos</Text>
        {shop.images.length > 0 ? (
          <View style={styles.imageGrid}>
            {shop.images.map((imageUrl: string, index: number) => (
              <Image
                key={`${imageUrl}-${index}`}
                source={{ uri: buildCloudinaryImageUrl(imageUrl, { width: 640, height: 640 }) }}
                style={styles.gridImage}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyText}>No photos were attached to this lead.</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notes</Text>
        <View style={styles.detailCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Mission</Text>
            <Text style={styles.detailValue}>{shop.mission}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Category</Text>
            <Text style={styles.detailValue}>{shop.category}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Outcome</Text>
            <Text style={styles.detailValue}>{getVisitOutcomeLabel(shop.outcome)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Neighborhood</Text>
            <Text style={styles.detailValue}>{shop.neighborhood || "Unknown"}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Contact</Text>
            <Text style={styles.detailValue}>{shop.contactPerson || "Not provided"}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Phone</Text>
            <Text style={styles.detailValue}>{shop.phone || "Not provided"}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Referral</Text>
            <Text style={styles.detailValue}>{shop.referredBy || "Direct capture"}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Captured</Text>
            <Text style={styles.detailValue}>{formatCaptureTime(shop.createdAt)}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.background,
  },
  centerTitle: {
    fontSize: typography.title,
    fontWeight: "700",
    color: palette.ink,
  },
  heroCard: {
    overflow: "hidden",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
  },
  heroImage: {
    width: "100%",
    height: 260,
  },
  heroPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 180,
    backgroundColor: palette.surfaceStrong,
    padding: spacing.lg,
  },
  heroPlaceholderText: {
    fontSize: typography.title,
    fontWeight: "700",
    color: palette.ink,
    textAlign: "center",
  },
  heroCopy: {
    gap: spacing.xs,
    padding: spacing.lg,
  },
  name: {
    fontSize: typography.headline,
    lineHeight: 36,
    fontWeight: "700",
    color: palette.ink,
  },
  meta: {
    fontSize: typography.body,
    color: palette.mutedInk,
  },
  timestamp: {
    marginTop: spacing.xs,
    fontSize: typography.overline,
    fontWeight: "700",
    color: palette.mutedInk,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  outcomePill: {
    alignSelf: "flex-start",
    marginTop: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: palette.accentSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  outcomePillText: {
    fontSize: typography.overline,
    fontWeight: "800",
    color: palette.accentStrong,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  primaryAction: {
    flex: 1,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: palette.accent,
  },
  primaryActionPressed: {
    backgroundColor: palette.accentStrong,
  },
  primaryActionText: {
    fontSize: typography.body,
    fontWeight: "700",
    color: palette.white,
  },
  secondaryAction: {
    flex: 1,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
  },
  secondaryActionPressed: {
    backgroundColor: palette.backgroundMuted,
  },
  secondaryActionText: {
    fontSize: typography.body,
    fontWeight: "700",
    color: palette.ink,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.overline,
    fontWeight: "700",
    color: palette.mutedInk,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  gridImage: {
    width: "48%",
    aspectRatio: 1,
    borderRadius: radii.md,
    backgroundColor: palette.surfaceStrong,
  },
  emptyBlock: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    padding: spacing.lg,
  },
  emptyText: {
    fontSize: typography.label,
    color: palette.mutedInk,
  },
  detailCard: {
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
    padding: spacing.lg,
  },
  locationPressed: {
    backgroundColor: palette.backgroundMuted,
  },
  detailRow: {
    gap: spacing.xxs,
  },
  detailRowInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  detailLabel: {
    fontSize: typography.overline,
    fontWeight: "700",
    color: palette.mutedInk,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  detailValue: {
    fontSize: typography.body,
    color: palette.ink,
    flexShrink: 1,
  },
  coordinateText: {
    fontSize: typography.overline,
    color: palette.mutedInk,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  locationHint: {
    fontSize: typography.overline,
    color: palette.accentStrong,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});
