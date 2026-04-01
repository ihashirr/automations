import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { action, internalMutation, mutation, query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_MISSION = "SME";
const DEFAULT_CATEGORY = "Unsorted";
const MAX_FEED_RESULTS = 180;
const MAX_FEED_SCAN = 400;

type ResolvedLocation = {
  lat: number;
  lng: number;
  formattedAddress: string;
} | null;

type NominatimReverseResponse = {
  address?: {
    city?: string;
    city_district?: string;
    neighbourhood?: string;
    quarter?: string;
    residential?: string;
    suburb?: string;
    town?: string;
    village?: string;
  };
};

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
}

function normalizeMission(value: string | undefined) {
  return normalizeText(value ?? "") || DEFAULT_MISSION;
}

function normalizeCategory(value: string | undefined) {
  return normalizeText(value ?? "") || DEFAULT_CATEGORY;
}

function normalizeNeighborhood(value: string | undefined) {
  return normalizeText(value ?? "");
}

function buildSearchText(fields: {
  category: string;
  formattedAddress: string;
  mission: string;
  name: string;
  neighborhood: string;
  phone: string;
  contactPerson: string;
  referredBy: string;
}) {
  return [
    fields.mission,
    fields.category,
    fields.name,
    fields.phone,
    fields.contactPerson,
    fields.referredBy,
    fields.formattedAddress,
    fields.neighborhood,
  ]
    .map((field) => normalizeText(field).toLowerCase())
    .filter(Boolean)
    .join(" ");
}

function normalizeLocation(location: {
  lat: number;
  lng: number;
  formattedAddress: string;
}): NonNullable<ResolvedLocation> {
  const formattedAddress = normalizeText(location.formattedAddress);

  if (!Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
    throw new Error("Pinned location is invalid.");
  }

  if (!formattedAddress) {
    throw new Error("Pinned location needs an address label.");
  }

  return {
    lat: location.lat,
    lng: location.lng,
    formattedAddress,
  };
}

function validateImages(images: string[]) {
  if (images.length > 6) {
    throw new Error("Add up to 6 images per shop.");
  }

  for (const imageUrl of images) {
    if (!/^https?:\/\//i.test(imageUrl)) {
      throw new Error("Image URLs must be absolute.");
    }
  }
}

function resolveMission(shop: Doc<"shops">) {
  return normalizeMission(shop.mission);
}

function resolveCategory(shop: Doc<"shops">) {
  return normalizeCategory(shop.category);
}

function isCoordinateLabel(value: string) {
  return /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/i.test(value.trim());
}

function fallbackNeighborhoodFromAddress(value: string | undefined) {
  const normalized = normalizeText(value ?? "");

  if (!normalized || isCoordinateLabel(normalized)) {
    return "";
  }

  return normalizeNeighborhood(normalized.split(",")[0]);
}

function resolveLocation(shop: Doc<"shops">): ResolvedLocation {
  if (shop.location) {
    return shop.location;
  }

  if (
    typeof shop.latitude === "number" &&
    typeof shop.longitude === "number" &&
    shop.address
  ) {
    return {
      lat: shop.latitude,
      lng: shop.longitude,
      formattedAddress: shop.address,
    };
  }

  return null;
}

function resolveNeighborhood(shop: Doc<"shops">, location: ResolvedLocation) {
  return (
    normalizeNeighborhood(shop.neighborhood) ||
    fallbackNeighborhoodFromAddress(location?.formattedAddress) ||
    fallbackNeighborhoodFromAddress(shop.address)
  );
}

async function resolveImageUrls(ctx: QueryCtx, shop: Doc<"shops">) {
  if (!shop.images) {
    return shop.imageUrls?.map((imageUrl) => imageUrl.trim()).filter(Boolean) ?? [];
  }

  if (shop.images.length === 0) {
    return [];
  }

  if (typeof shop.images[0] === "string") {
    return shop.images.map((imageUrl) => imageUrl.trim()).filter(Boolean);
  }

  const legacyUrls = await Promise.all(shop.images.map((imageId) => ctx.storage.getUrl(imageId)));
  return legacyUrls.filter((imageUrl): imageUrl is string => imageUrl !== null);
}

function extractNeighborhoodFromNominatim(payload: NominatimReverseResponse | null) {
  const address = payload?.address;

  if (!address) {
    return "";
  }

  return normalizeNeighborhood(
    address.suburb ??
      address.neighbourhood ??
      address.city_district ??
      address.quarter ??
      address.residential ??
      address.town ??
      address.village ??
      address.city,
  );
}

async function reverseGeocodeNeighborhood(location: NonNullable<ResolvedLocation>) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(location.lat));
  url.searchParams.set("lon", String(location.lng));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", "18");

  const response = await fetch(url.toString(), {
    headers: {
      "Accept-Language": "en",
      "User-Agent": "capture-app/1.0 field-intelligence",
    },
  });

  if (!response.ok) {
    return "";
  }

  const payload = (await response.json()) as NominatimReverseResponse;
  return extractNeighborhoodFromNominatim(payload);
}

function toSearchTextInput(shop: {
  category: string;
  mission: string;
  name: string;
  neighborhood: string;
  phone: string;
  contactPerson: string;
  referredBy: string;
  formattedAddress: string;
}) {
  return buildSearchText(shop);
}

async function toShopSummary(ctx: QueryCtx, shop: Doc<"shops">) {
  const images = await resolveImageUrls(ctx, shop);
  const location = resolveLocation(shop);
  const neighborhood = resolveNeighborhood(shop, location);

  return {
    _id: shop._id,
    _creationTime: shop._creationTime,
    category: resolveCategory(shop),
    name: shop.name,
    mission: resolveMission(shop),
    neighborhood,
    phone: shop.phone,
    contactPerson: shop.contactPerson,
    referredBy: shop.referredBy,
    images,
    previewImageUrl: images[0] ?? null,
    location,
    createdAt: shop.createdAt,
    updatedAt: shop.updatedAt ?? shop.createdAt,
  };
}

export const createShopRecord = internalMutation({
  args: {
    category: v.string(),
    name: v.string(),
    mission: v.string(),
    neighborhood: v.optional(v.string()),
    phone: v.string(),
    contactPerson: v.string(),
    referredBy: v.string(),
    images: v.array(v.string()),
    location: v.object({
      lat: v.number(),
      lng: v.number(),
      formattedAddress: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const mission = normalizeMission(args.mission);
    const category = normalizeCategory(args.category);
    const name = normalizeText(args.name);
    const phone = normalizePhone(args.phone);
    const contactPerson = normalizeText(args.contactPerson);
    const referredBy = normalizeText(args.referredBy);
    const images = args.images.map((imageUrl) => imageUrl.trim());
    const location = normalizeLocation(args.location);
    const neighborhood =
      normalizeNeighborhood(args.neighborhood) ||
      fallbackNeighborhoodFromAddress(location.formattedAddress);

    if (!name) {
      throw new Error("Shop name is required.");
    }

    validateImages(images);

    const createdAt = Date.now();

    return await ctx.db.insert("shops", {
      category,
      name,
      mission,
      neighborhood,
      phone,
      contactPerson,
      referredBy,
      images,
      location,
      latitude: location.lat,
      longitude: location.lng,
      address: location.formattedAddress,
      searchText: toSearchTextInput({
        category,
        mission,
        name,
        neighborhood,
        phone,
        contactPerson,
        referredBy,
        formattedAddress: location.formattedAddress,
      }),
      createdAt,
      updatedAt: createdAt,
    });
  },
});

export const createShop = action({
  args: {
    category: v.string(),
    name: v.string(),
    mission: v.string(),
    neighborhood: v.optional(v.string()),
    phone: v.string(),
    contactPerson: v.string(),
    referredBy: v.string(),
    images: v.array(v.string()),
    location: v.object({
      lat: v.number(),
      lng: v.number(),
      formattedAddress: v.string(),
    }),
  },
  handler: async (ctx, args): Promise<Id<"shops">> => {
    const location = normalizeLocation(args.location);
    let neighborhood =
      normalizeNeighborhood(args.neighborhood) ||
      fallbackNeighborhoodFromAddress(location.formattedAddress);

    try {
      neighborhood = neighborhood || (await reverseGeocodeNeighborhood(location));
    } catch {
      // Fall back to the client-provided or address-derived neighborhood.
    }

    return await ctx.runMutation(internal.shops.createShopRecord, {
      ...args,
      neighborhood,
    });
  },
});

export const moveShop = mutation({
  args: {
    shopId: v.id("shops"),
    mission: v.string(),
    category: v.string(),
  },
  handler: async (ctx, args) => {
    const shop = await ctx.db.get(args.shopId);

    if (!shop) {
      throw new Error("Lead not found.");
    }

    const mission = normalizeMission(args.mission);
    const category = normalizeCategory(args.category);
    const location = resolveLocation(shop);
    const neighborhood = resolveNeighborhood(shop, location);

    await ctx.db.patch(args.shopId, {
      mission,
      category,
      searchText: toSearchTextInput({
        category,
        mission,
        name: shop.name,
        neighborhood,
        phone: shop.phone,
        contactPerson: shop.contactPerson,
        referredBy: shop.referredBy,
        formattedAddress: location?.formattedAddress ?? shop.address ?? "",
      }),
      updatedAt: Date.now(),
    });
  },
});

export const listMissionFeed = query({
  args: {
    limit: v.number(),
    mission: v.string(),
  },
  handler: async (ctx, args) => {
    const mission = normalizeMission(args.mission);
    const candidateShops = await ctx.db
      .query("shops")
      .withIndex("by_createdAt")
      .order("desc")
      .take(MAX_FEED_SCAN);

    const limitedResults: Doc<"shops">[] = [];

    for (const shop of candidateShops) {
      if (resolveMission(shop) !== mission) {
        continue;
      }

      limitedResults.push(shop);

      if (limitedResults.length >= Math.max(1, Math.min(args.limit, MAX_FEED_RESULTS))) {
        break;
      }
    }

    return await Promise.all(limitedResults.map((shop) => toShopSummary(ctx, shop)));
  },
});

export const getShop = query({
  args: {
    shopId: v.id("shops"),
  },
  handler: async (ctx, args) => {
    const shop = await ctx.db.get(args.shopId);

    if (!shop) {
      return null;
    }

    const images = await resolveImageUrls(ctx, shop);
    const location = resolveLocation(shop);
    const neighborhood = resolveNeighborhood(shop, location);

    return {
      _id: shop._id,
      _creationTime: shop._creationTime,
      category: resolveCategory(shop),
      name: shop.name,
      mission: resolveMission(shop),
      neighborhood,
      phone: shop.phone,
      contactPerson: shop.contactPerson,
      referredBy: shop.referredBy,
      images,
      location,
      createdAt: shop.createdAt,
      updatedAt: shop.updatedAt ?? shop.createdAt,
    };
  },
});
