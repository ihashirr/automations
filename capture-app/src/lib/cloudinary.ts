const cloudinaryCloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
const cloudinaryUploadPreset = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim();

type CloudinaryTransformOptions = {
  height?: number;
  width?: number;
};

export function getCloudinaryUploadPreset() {
  if (!cloudinaryUploadPreset) {
    throw new Error(
      "EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET is required for photo uploads.",
    );
  }

  return cloudinaryUploadPreset;
}

export function getCloudinaryUploadEndpoint() {
  if (!cloudinaryCloudName) {
    throw new Error(
      "EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME is required for photo uploads.",
    );
  }

  return `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`;
}

export function buildCloudinaryImageUrl(
  imageUrl: string,
  { width, height }: CloudinaryTransformOptions,
) {
  if (!imageUrl.includes("res.cloudinary.com/") || !imageUrl.includes("/upload/")) {
    return imageUrl;
  }

  const transformations = [
    "f_auto",
    "q_auto",
    width ? `w_${Math.round(width)}` : null,
    height ? `h_${Math.round(height)}` : null,
    width && height ? "c_fill" : null,
  ]
    .filter(Boolean)
    .join(",");

  if (!transformations) {
    return imageUrl;
  }

  return imageUrl.replace("/upload/", `/upload/${transformations}/`);
}
