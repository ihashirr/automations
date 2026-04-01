import { Linking } from "react-native";
import { CapturedLocation } from "../types/shops";

export async function openLocationInMaps(location: CapturedLocation) {
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;
  await Linking.openURL(googleMapsUrl);
}
