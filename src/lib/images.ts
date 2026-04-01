import * as ImagePicker from "expo-image-picker";
import { DraftImage } from "../types/shops";

function extensionFromMimeType(mimeType: string) {
  if (mimeType.includes("png")) {
    return "png";
  }

  if (mimeType.includes("webp")) {
    return "webp";
  }

  return "jpg";
}

export function getFileExtension(
  fileName: string | undefined,
  uri: string,
  mimeType: string,
) {
  const candidate = fileName ?? uri.split("?")[0]?.split("/").pop() ?? "";
  const match = candidate.match(/\.([a-z0-9]+)$/i);

  if (match?.[1]) {
    return match[1].toLowerCase();
  }

  return extensionFromMimeType(mimeType);
}

export function mapPickerAssetsToDraftImages(assets: ImagePicker.ImagePickerAsset[]) {
  return assets.map<DraftImage>((asset) => ({
    localUri: asset.uri,
    mimeType: asset.mimeType ?? "image/jpeg",
    fileName:
      asset.fileName ??
      `capture-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${getFileExtension(
        undefined,
        asset.uri,
        asset.mimeType ?? "image/jpeg",
      )}`,
    width: asset.width,
    height: asset.height,
  }));
}
