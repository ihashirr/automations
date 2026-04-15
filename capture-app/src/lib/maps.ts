import { Linking, Platform } from "react-native";
import { CapturedLocation } from "../types/shops";

export async function openLocationInMaps(location: CapturedLocation) {
  const label = encodeURIComponent(location.formattedAddress || `${location.lat},${location.lng}`);
  const coordinates = `${location.lat},${location.lng}`;
  const candidates =
    Platform.OS === "ios"
      ? [`http://maps.apple.com/?ll=${coordinates}&q=${label}`]
      : [
          `geo:${coordinates}?q=${coordinates}(${label})`,
          `https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lng}#map=18/${location.lat}/${location.lng}`,
        ];

  for (const url of candidates) {
    const supported = await Linking.canOpenURL(url);

    if (supported) {
      await Linking.openURL(url);
      return;
    }
  }
}
