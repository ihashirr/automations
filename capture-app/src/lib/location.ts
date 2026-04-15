import { LocationGeocodedAddress } from "expo-location";
import { CapturedLocation } from "../types/shops";

const EARTH_RADIUS_METERS = 6371000;
export const REVERSE_GEOCODE_TIMEOUT_MS = 1200;

export function formatCoordinateLabel(fallbackCoordinates: { lat: number; lng: number }) {
  return `${fallbackCoordinates.lat.toFixed(6)}, ${fallbackCoordinates.lng.toFixed(6)}`;
}

function isCoordinateLabel(value: string) {
  return /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/i.test(value.trim());
}

export function buildFormattedAddress(
  placemark: LocationGeocodedAddress | null | undefined,
  fallbackCoordinates: { lat: number; lng: number },
) {
  if (!placemark) {
    return formatCoordinateLabel(fallbackCoordinates);
  }

  const primary =
    placemark.district ??
    placemark.street ??
    placemark.name ??
    placemark.city ??
    placemark.subregion;
  const secondary = placemark.city ?? placemark.subregion ?? placemark.region;
  const compactAddress = [primary, secondary]
    .map((segment) => segment?.trim())
    .filter(Boolean)
    .filter((segment, index, allSegments) => allSegments.indexOf(segment) === index)
    .join(", ");

  if (compactAddress) {
    return compactAddress;
  }

  return (
    placemark.formattedAddress ??
    formatCoordinateLabel(fallbackCoordinates)
  );
}

export function extractNeighborhoodName(
  placemark: LocationGeocodedAddress | null | undefined,
  formattedAddress: string,
) {
  const candidate =
    placemark?.district ??
    placemark?.subregion ??
    placemark?.city ??
    placemark?.street ??
    placemark?.name ??
    formattedAddress.split(",")[0];

  const normalized = candidate?.trim() ?? "";

  if (!normalized || /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/i.test(normalized)) {
    return "";
  }

  return normalized;
}

export async function resolveFormattedAddress(options: {
  allowReverseGeocode: boolean;
  coordinates: { lat: number; lng: number };
  reverseGeocode?: () => Promise<LocationGeocodedAddress[]>;
  timeoutMs?: number;
}) {
  return formatCoordinateLabel(options.coordinates);
}

export async function resolveLocationDetails(options: {
  allowReverseGeocode: boolean;
  coordinates: { lat: number; lng: number };
  reverseGeocode?: () => Promise<LocationGeocodedAddress[]>;
  timeoutMs?: number;
}) {
  const { allowReverseGeocode, coordinates, reverseGeocode, timeoutMs = REVERSE_GEOCODE_TIMEOUT_MS } =
    options;
  const formattedAddress = formatCoordinateLabel(coordinates);

  if (!allowReverseGeocode || !reverseGeocode) {
    return {
      addressLabel: undefined,
      formattedAddress,
      neighborhood: "",
    };
  }

  try {
    const placemark = await Promise.race<LocationGeocodedAddress | null>([
      reverseGeocode().then((placemarks) => placemarks[0] ?? null),
      new Promise<LocationGeocodedAddress | null>((resolve) => {
        setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
    const resolvedAddress = buildFormattedAddress(placemark, coordinates);
    const addressLabel =
      resolvedAddress && !isCoordinateLabel(resolvedAddress) ? resolvedAddress : undefined;

    return {
      addressLabel,
      formattedAddress,
      neighborhood: extractNeighborhoodName(placemark, addressLabel ?? formattedAddress),
    };
  } catch {
    return {
      addressLabel: undefined,
      formattedAddress,
      neighborhood: "",
    };
  }
}

export function getLocationAreaLabel(location: CapturedLocation | null | undefined) {
  if (!location) {
    return null;
  }

  const addressLabel = location.addressLabel?.trim();

  if (addressLabel) {
    return addressLabel;
  }

  const formattedAddress = location.formattedAddress?.trim();

  if (formattedAddress && !isCoordinateLabel(formattedAddress)) {
    return formattedAddress;
  }

  return null;
}

export function getLocationLabel(location: CapturedLocation | null | undefined) {
  if (!location) {
    return null;
  }

  const areaLabel = getLocationAreaLabel(location);

  if (areaLabel) {
    return areaLabel;
  }

  const formattedAddress = location.formattedAddress?.trim();

  return formattedAddress || formatCoordinateLabel(location);
}

export function isCoordinateOnlyLocation(location: CapturedLocation | null | undefined) {
  if (!location) {
    return false;
  }

  return !getLocationAreaLabel(location) && getLocationLabel(location) === formatCoordinateLabel(location);
}

export function calculateDistanceMeters(
  origin: CapturedLocation,
  destination: CapturedLocation,
) {
  const latitude1 = (origin.lat * Math.PI) / 180;
  const latitude2 = (destination.lat * Math.PI) / 180;
  const deltaLatitude = ((destination.lat - origin.lat) * Math.PI) / 180;
  const deltaLongitude = ((destination.lng - origin.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2) +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(deltaLongitude / 2) *
      Math.sin(deltaLongitude / 2);

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
