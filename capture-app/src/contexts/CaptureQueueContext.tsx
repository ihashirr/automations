import { useAction } from "convex/react";
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useNetInfo } from "@react-native-community/netinfo";
import { api } from "../../convex/_generated/api";
import { defaultMission } from "../constants/missions";
import { createPendingCapture, deletePendingCaptureImages, loadPendingCaptures, persistPendingCaptures } from "../lib/queue-storage";
import { humanizeSyncIssue, normalizeText, sanitizePhoneInput } from "../lib/format";
import { uploadImages } from "../lib/upload";
import { PendingCapture, ShopDraft } from "../types/shops";

type SaveCaptureResult =
  | { status: "saved" }
  | { status: "queued"; reason: string };

type CaptureQueueContextValue = {
  flushQueue: () => Promise<void>;
  isFlushing: boolean;
  isOnline: boolean;
  lastSyncIssue: string | null;
  pendingCaptures: PendingCapture[];
  pendingCount: number;
  queueReady: boolean;
  deletePendingCapture: (localId: string) => Promise<void>;
  reclassifyPendingCapture: (args: {
    category: string;
    localId: string;
    mission: string;
  }) => Promise<void>;
  updatePendingCapture: (args: {
    contactPerson: string;
    localId: string;
    name: string;
    nextStep?: string;
    phone: string;
    role?: string;
  }) => Promise<void>;
  saveCapture: (draft: ShopDraft) => Promise<SaveCaptureResult>;
};

const CaptureQueueContext = createContext<CaptureQueueContextValue | null>(null);

function normalizeDraft(draft: ShopDraft): ShopDraft {
  return {
    ...draft,
    category: normalizeText(draft.category) || "Unsorted",
    mission: normalizeText(draft.mission) || defaultMission.label,
    neighborhood: normalizeText(draft.neighborhood),
    name: normalizeText(draft.name),
    phone: sanitizePhoneInput(draft.phone),
    contactPerson: normalizeText(draft.contactPerson),
    role: normalizeText(draft.role ?? ""),
    referredBy: normalizeText(draft.referredBy),
    nextStep: normalizeText(draft.nextStep ?? ""),
    outcome: draft.outcome,
    location: draft.location
      ? {
          ...draft.location,
          addressLabel: normalizeText(draft.location.addressLabel ?? "") || undefined,
          formattedAddress: normalizeText(draft.location.formattedAddress),
        }
      : null,
  };
}

function shouldContinueQueueAfterSyncError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  return (
    message.includes("EXPO_PUBLIC_CLOUDINARY_") ||
    message.includes("Cloudinary configuration error") ||
    message.includes("Cloudinary upload failed") ||
    message.includes("Cloudinary network error")
  );
}

function isLegacyAddressLabelValidatorError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return message.includes("extra field `addressLabel`") && message.includes("Path: .location");
}

function toLegacyLocation(location: NonNullable<ShopDraft["location"]>) {
  return {
    lat: location.lat,
    lng: location.lng,
    formattedAddress: normalizeText(location.addressLabel ?? "") || location.formattedAddress,
  };
}

export function CaptureQueueProvider({ children }: { children: ReactNode }) {
  const createShop = useAction(api.shops.createShop);
  const netInfo = useNetInfo();
  const [pendingCaptures, setPendingCaptures] = useState<PendingCapture[]>([]);
  const [queueReady, setQueueReady] = useState(false);
  const [isFlushing, setIsFlushing] = useState(false);
  const [lastSyncIssue, setLastSyncIssue] = useState<string | null>(null);
  const isOnline = Boolean(netInfo.isConnected) && netInfo.isInternetReachable !== false;
  const pendingCapturesRef = useRef<PendingCapture[]>([]);
  const isFlushingRef = useRef(false);
  const isOnlineRef = useRef(isOnline);
  const queueReadyRef = useRef(queueReady);
  const flushQueueRef = useRef<() => Promise<void>>(async () => {});

  async function replacePendingCaptures(nextQueue: PendingCapture[]) {
    pendingCapturesRef.current = nextQueue;
    setPendingCaptures(nextQueue);
    await persistPendingCaptures(nextQueue);
  }

  async function enqueueDraft(draft: ShopDraft) {
    const queuedCapture = await createPendingCapture(draft);
    await replacePendingCaptures([queuedCapture, ...pendingCapturesRef.current]);
    return queuedCapture;
  }

  async function reclassifyPendingCapture(args: {
    category: string;
    localId: string;
    mission: string;
  }) {
    const nextQueue = pendingCapturesRef.current.map((capture) =>
      capture.localId === args.localId
        ? {
            ...capture,
            category: normalizeText(args.category) || "Unsorted",
            mission: normalizeText(args.mission) || defaultMission.label,
          }
        : capture,
    );

    await replacePendingCaptures(nextQueue);
  }

  async function updatePendingCapture(args: {
    contactPerson: string;
    localId: string;
    name: string;
    nextStep?: string;
    phone: string;
    role?: string;
  }) {
    const nextQueue = pendingCapturesRef.current.map((capture) =>
      capture.localId === args.localId
        ? {
            ...capture,
            contactPerson: normalizeText(args.contactPerson),
            name: normalizeText(args.name),
            nextStep: normalizeText(args.nextStep ?? ""),
            phone: sanitizePhoneInput(args.phone),
            role: normalizeText(args.role ?? ""),
          }
        : capture,
    );

    await replacePendingCaptures(nextQueue);
  }

  async function deletePendingCapture(localId: string) {
    const target = pendingCapturesRef.current.find((capture) => capture.localId === localId);
    const nextQueue = pendingCapturesRef.current.filter((capture) => capture.localId !== localId);

    if (target) {
      deletePendingCaptureImages(target.images);
    }

    await replacePendingCaptures(nextQueue);
  }

  async function syncCapture(draft: ShopDraft) {
    if (!draft.location) {
      throw new Error("Pin the shop location before saving.");
    }
    if (!draft.outcome) {
      throw new Error("Select the visit outcome before saving.");
    }

    const imageUrls =
      draft.images.length > 0 ? await uploadImages(draft.images) : [];

    const createShopArgs = {
      category: draft.category,
      name: draft.name,
      mission: draft.mission,
      neighborhood: draft.neighborhood,
      phone: draft.phone,
      contactPerson: draft.contactPerson,
      role: draft.role ?? "",
      referredBy: draft.referredBy,
      nextStep: draft.nextStep ?? "",
      outcome: draft.outcome,
      images: imageUrls,
      location: draft.location,
    };

    try {
      await createShop(createShopArgs);
    } catch (error) {
      if (!draft.location.addressLabel || !isLegacyAddressLabelValidatorError(error)) {
        throw error;
      }

      // Current deployed Convex validators may not accept addressLabel yet.
      await createShop({
        ...createShopArgs,
        location: toLegacyLocation(draft.location),
      });
    }
  }

  flushQueueRef.current = async () => {
    if (
      !queueReadyRef.current ||
      !isOnlineRef.current ||
      isFlushingRef.current ||
      pendingCapturesRef.current.length === 0
    ) {
      return;
    }

    isFlushingRef.current = true;
    setIsFlushing(true);
    setLastSyncIssue(null);

    const queueSnapshot = [...pendingCapturesRef.current];
    const remainingCaptures: PendingCapture[] = [];
    let syncIssue: string | null = null;

    for (let index = 0; index < queueSnapshot.length; index += 1) {
      const capture = queueSnapshot[index];

      try {
        await syncCapture(capture);
        deletePendingCaptureImages(capture.images);
      } catch (error) {
        syncIssue = syncIssue ?? humanizeSyncIssue(error);
        remainingCaptures.push(capture);

        if (!shouldContinueQueueAfterSyncError(error)) {
          remainingCaptures.push(...queueSnapshot.slice(index + 1));
          break;
        }
      }
    }

    if (syncIssue) {
      setLastSyncIssue(syncIssue);
    }

    await replacePendingCaptures(remainingCaptures);
    isFlushingRef.current = false;
    setIsFlushing(false);
  };

  useEffect(() => {
    let cancelled = false;

    void loadPendingCaptures().then((queue) => {
      if (cancelled) {
        return;
      }

      pendingCapturesRef.current = queue;
      setPendingCaptures(queue);
      setQueueReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    queueReadyRef.current = queueReady;
  }, [queueReady]);

  useEffect(() => {
    if (queueReady && isOnline && pendingCaptures.length > 0) {
      void flushQueueRef.current();
    }
  }, [isOnline, pendingCaptures.length, queueReady]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void flushQueueRef.current();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  async function saveCapture(draft: ShopDraft): Promise<SaveCaptureResult> {
    const normalizedDraft = normalizeDraft(draft);

    if (!normalizedDraft.name) {
      throw new Error("Shop name is required.");
    }

    if (!normalizedDraft.location) {
      throw new Error("Pin the shop location before saving.");
    }
    if (!normalizedDraft.outcome) {
      throw new Error("Select the visit outcome before saving.");
    }

    if (!isOnline) {
      await enqueueDraft(normalizedDraft);
      const reason = "Offline. Entry queued locally.";
      setLastSyncIssue(reason);
      return { status: "queued", reason };
    }

    try {
      await syncCapture(normalizedDraft);
      return { status: "saved" };
    } catch (error) {
      await enqueueDraft(normalizedDraft);
      const reason = humanizeSyncIssue(error);
      setLastSyncIssue(reason);
      return { status: "queued", reason };
    }
  }

  return (
    <CaptureQueueContext.Provider
      value={{
        flushQueue: async () => {
          await flushQueueRef.current();
        },
        isFlushing,
        isOnline,
        lastSyncIssue,
        pendingCaptures,
        pendingCount: pendingCaptures.length,
        queueReady,
        deletePendingCapture,
        reclassifyPendingCapture,
        updatePendingCapture,
        saveCapture,
      }}
    >
      {children}
    </CaptureQueueContext.Provider>
  );
}

export function useCaptureQueue() {
  const context = useContext(CaptureQueueContext);

  if (!context) {
    throw new Error("useCaptureQueue must be used inside CaptureQueueProvider.");
  }

  return context;
}
