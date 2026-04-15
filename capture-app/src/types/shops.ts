import { Id } from "../../convex/_generated/dataModel";
import { VisitOutcome, VisitOutcomeValue } from "../constants/visit-outcomes";

export type DraftImage = {
  localUri: string;
  mimeType: string;
  fileName: string;
  width?: number;
  height?: number;
};

export type CapturedLocation = {
  lat: number;
  lng: number;
  formattedAddress: string;
  addressLabel?: string;
};

export type ShopDraft = {
  category: string;
  name: string;
  mission: string;
  neighborhood: string;
  phone: string;
  contactPerson: string;
  role?: string;
  referredBy: string;
  nextStep?: string;
  outcome: VisitOutcome | null;
  images: DraftImage[];
  location: CapturedLocation | null;
};

export type PendingCapture = ShopDraft & {
  localId: string;
  createdAt: number;
};

export type ShopSummary = {
  _id: Id<"shops">;
  _creationTime: number;
  category: string;
  name: string;
  mission: string;
  neighborhood: string;
  phone: string;
  contactPerson: string;
  role?: string;
  outcome: VisitOutcomeValue;
  previewImageUrl: string | null;
  location: CapturedLocation | null;
  createdAt: number;
  updatedAt: number;
};

export type ShopMapPin = {
  _id: Id<"shops">;
  category: string;
  name: string;
  phone: string;
  location: CapturedLocation | null;
  createdAt: number;
};

export type ShopDetail = {
  _id: Id<"shops">;
  _creationTime: number;
  category: string;
  name: string;
  mission: string;
  neighborhood: string;
  phone: string;
  contactPerson: string;
  role?: string;
  referredBy: string;
  nextStep?: string;
  outcome: VisitOutcomeValue;
  images: string[];
  location: CapturedLocation | null;
  createdAt: number;
  updatedAt: number;
};

export type DuplicateCandidate = {
  id: string;
  category: string;
  mission: string;
  name: string;
  neighborhood: string;
  phone: string;
  outcome: VisitOutcomeValue;
  createdAt: number;
  source: "live" | "queued";
};
