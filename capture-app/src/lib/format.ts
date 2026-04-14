import { CapturedLocation, PendingCapture } from "../types/shops";

const captureTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function sanitizePhoneInput(value: string) {
  return value.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
}

export function normalizeSearchText(value: string) {
  return normalizeText(value).toLowerCase();
}

export function formatCaptureTime(value: number) {
  return captureTimeFormatter.format(value);
}

export function buildSearchText(fields: string[]) {
  return fields.map(normalizeSearchText).filter(Boolean).join(" ");
}

export function matchesPendingCapture(capture: PendingCapture, rawQuery: string) {
  const query = normalizeSearchText(rawQuery);

  if (!query) {
    return true;
  }

  const searchableText = buildSearchText([
    capture.name,
    capture.phone,
    capture.contactPerson,
    capture.role ?? "",
    capture.referredBy,
    capture.nextStep ?? "",
    capture.location?.formattedAddress ?? "",
  ]);

  return searchableText.includes(query);
}

export function buildDialLink(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function sanitizePhoneForWhatsApp(phone: string) {
  const compact = phone.replace(/[^\d+]/g, "");

  if (!compact) {
    return "";
  }

  if (compact.startsWith("+")) {
    return compact.slice(1);
  }

  if (compact.startsWith("00")) {
    return compact.slice(2);
  }

  if (compact.startsWith("971")) {
    return compact;
  }

  if (compact.length === 9 && compact.startsWith("5")) {
    return `971${compact}`;
  }

  if (compact.startsWith("0")) {
    return `971${compact.slice(1)}`;
  }

  return compact;
}

export function buildWhatsAppLink(phone: string) {
  const sanitizedPhone = sanitizePhoneForWhatsApp(phone);
  return sanitizedPhone ? `https://wa.me/${sanitizedPhone}` : "";
}

export function formatDistance(distanceMeters: number | null) {
  if (distanceMeters == null) {
    return null;
  }

  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)}m`;
  }

  const distanceKm = distanceMeters / 1000;

  if (distanceKm >= 10) {
    return `${Math.round(distanceKm)}km`;
  }

  return `${distanceKm.toFixed(1)}km`;
}

export function formatCoordinates(location: CapturedLocation) {
  return `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;
}

export function getInitials(value: string) {
  const words = normalizeText(value).split(" ").filter(Boolean);

  if (words.length === 0) {
    return "?";
  }

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export function humanizeSyncIssue(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Sync paused. Entries are safe on this device.";

  if (message.includes("EXPO_PUBLIC_CLOUDINARY_")) {
    return "Add your Cloudinary cloud name and unsigned upload preset in .env.local.";
  }

  if (message.includes("Cloudinary configuration error")) {
    return message.replace("Cloudinary configuration error:", "Cloudinary setup issue:");
  }

  if (message.includes("Cloudinary network error")) {
    return "Photo upload is paused by network issues. The lead is queued locally.";
  }

  if (message.includes("Cloudinary upload failed")) {
    return message;
  }

  if (message.includes("Network request failed")) {
    return "No connection. Entries are queued locally.";
  }

  return "Sync paused. Entries are queued locally until the app can reach the backend.";
}
