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
  reclassifyPendingCapture: (args: {
    category: string;
    localId: string;
    mission: string;
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

  async function syncCapture(draft: ShopDraft) {
    if (!draft.location) {
      throw new Error("Pin the shop location before saving.");
    }
    if (!draft.outcome) {
      throw new Error("Select the visit outcome before saving.");
    }

    const imageUrls =
      draft.images.length > 0 ? await uploadImages(draft.images) : [];

    await createShop({
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
    });
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

    for (let index = 0; index < queueSnapshot.length; index += 1) {
      const capture = queueSnapshot[index];

      try {
        await syncCapture(capture);
        deletePendingCaptureImages(capture.images);
      } catch (error) {
        setLastSyncIssue(humanizeSyncIssue(error));
        remainingCaptures.push(...queueSnapshot.slice(index));
        break;
      }
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
        reclassifyPendingCapture,
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
