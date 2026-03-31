import { DraftImage } from "../types/shops";
import { getFileExtension } from "./images";

export type UploadTarget = {
  uploadUrl: string;
  publicUrl: string;
  method: "PUT";
  headers: Record<string, string>;
};

export type CreateImageUploadUrl = (args: {
  contentType: string;
  extension?: string;
}) => Promise<UploadTarget>;

export async function uploadImages(
  images: DraftImage[],
  createImageUploadUrl: CreateImageUploadUrl,
) {
  return await Promise.all(
    images.map(async (image) => {
      const sourceResponse = await fetch(image.localUri);
      if (!sourceResponse.ok) {
        throw new Error("Queued photo is missing from device storage.");
      }

      const sourceBlob = await sourceResponse.blob();

      const target = await createImageUploadUrl({
        contentType: image.mimeType,
        extension: getFileExtension(image.fileName, image.localUri, image.mimeType),
      });

      const response = await fetch(target.uploadUrl, {
        method: target.method,
        headers: target.headers,
        body: sourceBlob,
      });

      if (!response.ok) {
        throw new Error(`Image upload failed with status ${response.status}.`);
      }

      return target.publicUrl;
    }),
  );
}
