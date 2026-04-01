import { Id } from "../../convex/_generated/dataModel";

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
};

export type ShopDraft = {
  category: string;
  name: string;
  mission: string;
  neighborhood: string;
  phone: string;
  contactPerson: string;
  referredBy: string;
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
  referredBy: string;
  images: string[];
  previewImageUrl: string | null;
  location: CapturedLocation | null;
  createdAt: number;
  updatedAt: number;
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
  referredBy: string;
  images: string[];
  location: CapturedLocation | null;
  createdAt: number;
  updatedAt: number;
};
