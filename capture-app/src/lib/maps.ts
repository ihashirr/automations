import { Linking, Platform } from "react-native";
import { CapturedLocation } from "../types/shops";

export async function openLocationInMaps(location: CapturedLocation) {
  const coordinates = `${location.lat},${location.lng}`;
  const encodedCoordinates = encodeURIComponent(coordinates);
  const candidates =
    Platform.OS === "ios"
      ? [
          `comgooglemaps://?q=${encodedCoordinates}&center=${encodedCoordinates}&zoom=18`,
          `maps://?ll=${encodedCoordinates}&q=${encodedCoordinates}`,
        ]
      : [
          `google.navigation:q=${encodedCoordinates}`,
          `geo:0,0?q=${encodedCoordinates}`,
        ];

  for (const url of candidates) {
    try {
      await Linking.openURL(url);
      return;
    } catch {
      // Try the web fallback below.
    }
  }

  await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodedCoordinates}`);
}
