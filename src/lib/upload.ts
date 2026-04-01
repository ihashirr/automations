import * as ImageManipulator from "expo-image-manipulator";
import { Platform } from "react-native";
import { DraftImage } from "../types/shops";
import { getCloudinaryUploadEndpoint, getCloudinaryUploadPreset } from "./cloudinary";

type CloudinaryUploadResponse = {
  error?: {
    message?: string;
  };
  secure_url?: string;
};

type ReactNativeFile = {
  name: string;
  type: string;
  uri: string;
};

function buildUploadFileName(image: DraftImage) {
  const baseName = image.fileName?.replace(/\.[a-z0-9]+$/i, "") ?? `shop-${Date.now()}`;
  return `${baseName}.jpg`;
}

async function compressImage(image: DraftImage) {
  return await ImageManipulator.manipulateAsync(
    image.localUri,
    [{ resize: { width: 800 } }],
    {
      compress: 0.6,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );
}

function isCloudinaryConfigError(message: string) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("upload preset") ||
    normalized.includes("unsigned") ||
    normalized.includes("not found") ||
    normalized.includes("invalid cloud name") ||
    normalized.includes("must be whitelisted")
  );
}

async function buildUploadBody(image: DraftImage) {
  const manipulatedImage = await compressImage(image);
  const fileName = buildUploadFileName(image);
  const formData = new FormData();

  if (Platform.OS === "web") {
    const sourceResponse = await fetch(manipulatedImage.uri);

    if (!sourceResponse.ok) {
      throw new Error("Cloudinary upload failed: compressed image could not be loaded.");
    }

    const sourceBlob = await sourceResponse.blob();
    formData.append("file", sourceBlob, fileName);
  } else {
    const file: ReactNativeFile = {
      uri: manipulatedImage.uri,
      type: "image/jpeg",
      name: fileName,
    };

    formData.append("file", file as unknown as Blob);
  }

  formData.append("upload_preset", getCloudinaryUploadPreset());

  return formData;
}

async function uploadImage(image: DraftImage) {
  const formData = await buildUploadBody(image);

  let response: Response;

  try {
    response = await fetch(getCloudinaryUploadEndpoint(), {
      method: "POST",
      body: formData,
    });
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Cloudinary network error: ${error.message}`
        : "Cloudinary network error: request failed.",
    );
  }

  const responseText = await response.text();
  let payload: CloudinaryUploadResponse | null = null;

  if (responseText) {
    try {
      payload = JSON.parse(responseText) as CloudinaryUploadResponse;
    } catch {
      payload = null;
    }
  }

  const cloudinaryMessage =
    payload?.error?.message?.trim() ||
    responseText.trim() ||
    `Cloudinary upload failed with status ${response.status}.`;
  const secureUrl = payload?.secure_url?.trim();

  if (!response.ok || !secureUrl) {
    if (isCloudinaryConfigError(cloudinaryMessage)) {
      throw new Error(`Cloudinary configuration error: ${cloudinaryMessage}`);
    }

    throw new Error(`Cloudinary upload failed: ${cloudinaryMessage}`);
  }

  return secureUrl;
}

export async function uploadImages(images: DraftImage[]) {
  return await Promise.all(images.map((image) => uploadImage(image)));
}
