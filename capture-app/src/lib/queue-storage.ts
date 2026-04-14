import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import { defaultMission } from "../constants/missions";
import { isVisitOutcome } from "../constants/visit-outcomes";
import { getFileExtension } from "./images";
import { PendingCapture, ShopDraft } from "../types/shops";

const STORAGE_KEY = "@capture-app/pending-shop-captures:v2";
const queueDirectoryUri =
  FileSystem.documentDirectory != null
    ? `${FileSystem.documentDirectory}pending-shop-captures/`
    : null;

async function ensureQueueDirectory() {
  if (!queueDirectoryUri || Platform.OS === "web") {
    return;
  }

  const info = await FileSystem.getInfoAsync(queueDirectoryUri);

  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(queueDirectoryUri, { intermediates: true });
  }
}

export async function loadPendingCaptures() {
  const rawQueue = await AsyncStorage.getItem(STORAGE_KEY);

  if (!rawQueue) {
    return [] as PendingCapture[];
  }

  try {
    return (JSON.parse(rawQueue) as PendingCapture[]).map((capture) => ({
      ...capture,
      category: capture.category?.trim() || "Unsorted",
      mission: capture.mission?.trim() || defaultMission.label,
      neighborhood: capture.neighborhood?.trim() || "",
      role: capture.role?.trim() || "",
      nextStep: capture.nextStep?.trim() || "",
      outcome:
        typeof capture.outcome === "string" && isVisitOutcome(capture.outcome)
          ? capture.outcome
          : null,
    }));
  } catch {
    return [];
  }
}

export async function persistPendingCaptures(queue: PendingCapture[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export async function createPendingCapture(draft: ShopDraft) {
  await ensureQueueDirectory();

  const localId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = Date.now();

  const images = await Promise.all(draft.images.map(async (image, index) => {
    if (!queueDirectoryUri || Platform.OS === "web") {
      return image;
    }

    const extension = getFileExtension(image.fileName, image.localUri, image.mimeType);
    const destination = `${queueDirectoryUri}${localId}-${index}.${extension}`;

    const existingFile = await FileSystem.getInfoAsync(destination);

    if (existingFile.exists) {
      await FileSystem.deleteAsync(destination, { idempotent: true });
    }

    await FileSystem.copyAsync({ from: image.localUri, to: destination });

    return {
      ...image,
      localUri: destination,
      fileName: destination.split("/").pop() ?? `${localId}-${index}.${extension}`,
    };
  }));

  return {
    ...draft,
    images,
    localId,
    createdAt,
  } satisfies PendingCapture;
}

export function deletePendingCaptureImages(images: PendingCapture["images"]) {
  if (Platform.OS === "web") {
    return;
  }

  for (const image of images) {
    void FileSystem.deleteAsync(image.localUri, { idempotent: true }).catch(() => {
      // Ignore cleanup failures for queued media.
    });
  }
}
