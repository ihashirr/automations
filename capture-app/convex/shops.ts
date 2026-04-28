import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { action, internalMutation, mutation, query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { isVisitOutcome, VisitOutcomeValue } from "../src/constants/visit-outcomes";

const DEFAULT_MISSION = "SME";
const DEFAULT_CATEGORY = "Unsorted";
const MAX_FEED_RESULTS = 180;
const MAX_FEED_SCAN = 400;

type ResolvedLocation = {
  lat: number;
  lng: number;
  formattedAddress: string;
  addressLabel?: string;
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

function normalizeIndexText(value: string) {
  return normalizeText(value).toLowerCase();
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

function normalizeOutcome(value: string) {
  if (!isVisitOutcome(value)) {
    throw new Error("Visit outcome is invalid.");
  }

  return value;
}

function formatCoordinateLabel(location: { lat: number; lng: number }) {
  return `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
}

function buildSearchText(fields: {
  category: string;
  formattedAddress: string;
  mission: string;
  name: string;
  neighborhood: string;
  phone: string;
  contactPerson: string;
  role: string;
  referredBy: string;
  nextStep: string;
  outcome: string;
}) {
  return [
    fields.mission,
    fields.category,
    fields.name,
    fields.phone,
    fields.contactPerson,
    fields.role,
    fields.referredBy,
    fields.nextStep,
    fields.outcome,
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
  addressLabel?: string;
}): NonNullable<ResolvedLocation> {
  const formattedAddress = normalizeText(location.formattedAddress);
  const coordinateLabel = formatCoordinateLabel(location);
  const normalizedAddressLabel = normalizeText(location.addressLabel ?? "");

  if (!Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
    throw new Error("Pinned location is invalid.");
  }

  if (!formattedAddress) {
    throw new Error("Pinned location needs an address label.");
  }

  return {
    lat: location.lat,
    lng: location.lng,
    formattedAddress: isCoordinateLabel(formattedAddress) ? formattedAddress : coordinateLabel,
    addressLabel:
      normalizedAddressLabel ||
      (!isCoordinateLabel(formattedAddress) ? formattedAddress : undefined),
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

function resolveOutcome(shop: Doc<"shops">): VisitOutcomeValue {
  return shop.outcome && isVisitOutcome(shop.outcome) ? shop.outcome : "unknown";
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
    return normalizeLocation(shop.location);
  }

  if (
    typeof shop.latitude === "number" &&
    typeof shop.longitude === "number" &&
    shop.address
  ) {
    return {
      lat: shop.latitude,
      lng: shop.longitude,
      formattedAddress: isCoordinateLabel(shop.address)
        ? normalizeText(shop.address)
        : formatCoordinateLabel({ lat: shop.latitude, lng: shop.longitude }),
      addressLabel: !isCoordinateLabel(shop.address) ? normalizeText(shop.address) : undefined,
    };
  }

  return null;
}

function resolveNeighborhood(shop: Doc<"shops">, location: ResolvedLocation) {
  return (
    normalizeNeighborhood(shop.neighborhood) ||
    fallbackNeighborhoodFromAddress(location?.addressLabel ?? location?.formattedAddress) ||
    fallbackNeighborhoodFromAddress(shop.address)
  );
}

function buildLocationSearchText(location: ResolvedLocation, fallbackAddress?: string) {
  const values = [location?.addressLabel, location?.formattedAddress, fallbackAddress]
    .map((value) => normalizeText(value ?? ""))
    .filter(Boolean);

  return values.filter((value, index) => values.indexOf(value) === index).join(" ");
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

async function resolvePreviewImageUrl(ctx: QueryCtx, shop: Doc<"shops">) {
  if (!shop.images) {
    return shop.imageUrls?.map((imageUrl) => imageUrl.trim()).find(Boolean) ?? null;
  }

  if (shop.images.length === 0) {
    return null;
  }

  const [firstImage] = shop.images;

  if (typeof firstImage === "string") {
    const trimmed = firstImage.trim();
    return trimmed || null;
  }

  return await ctx.storage.getUrl(firstImage);
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
  role: string;
  referredBy: string;
  nextStep: string;
  outcome: string;
  formattedAddress: string;
}) {
  return buildSearchText(shop);
}

async function toShopSummary(ctx: QueryCtx, shop: Doc<"shops">) {
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
    role: shop.role ?? "",
    nextStep: shop.nextStep ?? "",
    outcome: resolveOutcome(shop),
    previewImageUrl: await resolvePreviewImageUrl(ctx, shop),
    location,
    createdAt: shop.createdAt,
    updatedAt: shop.updatedAt ?? shop.createdAt,
  };
}

function toMapPin(shop: Doc<"shops">) {
  const location = resolveLocation(shop);

  return {
    _id: shop._id,
    category: resolveCategory(shop),
    name: shop.name,
    phone: shop.phone,
    location,
    createdAt: shop.createdAt,
  };
}

export const createShopRecord = internalMutation({
  args: {
    category: v.string(),
    name: v.string(),
    mission: v.string(),
    neighborhood: v.string(),
    phone: v.string(),
    contactPerson: v.string(),
    role: v.optional(v.string()),
    referredBy: v.string(),
    nextStep: v.optional(v.string()),
    outcome: v.string(),
    images: v.array(v.string()),
    location: v.object({
      lat: v.number(),
      lng: v.number(),
      formattedAddress: v.string(),
      addressLabel: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const mission = normalizeMission(args.mission);
    const category = normalizeCategory(args.category);
    const name = normalizeText(args.name);
    const phone = normalizePhone(args.phone);
    const contactPerson = normalizeText(args.contactPerson);
    const role = normalizeText(args.role ?? "");
    const referredBy = normalizeText(args.referredBy);
    const nextStep = normalizeText(args.nextStep ?? "");
    const outcome = normalizeOutcome(args.outcome);
    const images = args.images.map((imageUrl) => imageUrl.trim());
    const location = normalizeLocation(args.location);
    const neighborhood = normalizeNeighborhood(args.neighborhood);
    const normalizedName = normalizeIndexText(name);
    const normalizedNeighborhood = normalizeIndexText(
      neighborhood || fallbackNeighborhoodFromAddress(location.addressLabel ?? location.formattedAddress),
    );
    const normalizedPhone = normalizePhone(phone);

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
      role,
      referredBy,
      nextStep,
      outcome,
      normalizedName,
      normalizedNeighborhood,
      normalizedPhone,
      images,
      location,
      latitude: location.lat,
      longitude: location.lng,
      address: location.addressLabel ?? location.formattedAddress,
      searchText: toSearchTextInput({
        category,
        mission,
        name,
        neighborhood,
        phone,
        contactPerson,
        role,
        referredBy,
        nextStep,
        outcome,
        formattedAddress: buildLocationSearchText(location),
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
    role: v.optional(v.string()),
    referredBy: v.string(),
    nextStep: v.optional(v.string()),
    outcome: v.string(),
    images: v.array(v.string()),
    location: v.object({
      lat: v.number(),
      lng: v.number(),
      formattedAddress: v.string(),
      addressLabel: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args): Promise<Id<"shops">> => {
    const location = normalizeLocation(args.location);
    let neighborhood =
      normalizeNeighborhood(args.neighborhood) ||
      fallbackNeighborhoodFromAddress(location.addressLabel ?? location.formattedAddress);

    let needsBackgroundEnrichment = false;

    if (!neighborhood) {
      try {
        // Attempt fast reverse geocode (1s timeout)
        neighborhood = await Promise.race([
          reverseGeocodeNeighborhood(location),
          new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 1000)
          ),
        ]);
      } catch {
        needsBackgroundEnrichment = true;
        neighborhood = "Pending..."; // Initial placeholder
      }
    }

    const shopId = await ctx.runMutation(internal.shops.createShopRecord, {
      ...args,
      neighborhood,
    });

    if (needsBackgroundEnrichment) {
      await ctx.scheduler.runAfter(0, internal.shops.enrichNeighborhood, {
        shopId,
        location,
      });
    }

    return shopId;
  },
});

export const enrichNeighborhood = internalMutation({
  args: {
    shopId: v.id("shops"),
    location: v.object({
      lat: v.number(),
      lng: v.number(),
      formattedAddress: v.string(),
      addressLabel: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const shop = await ctx.db.get(args.shopId);
    if (!shop) return;

    // Only enrich if still "Pending..." or empty
    if (shop.neighborhood !== "Pending..." && shop.neighborhood !== "") {
      return;
    }

    const neighborhood = await reverseGeocodeNeighborhood(args.location);
    if (neighborhood) {
      await ctx.db.patch(args.shopId, {
        neighborhood,
        updatedAt: Date.now(),
      });
    }
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

    if (resolveMission(shop) === mission && resolveCategory(shop) === category) {
      return;
    }

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
        role: shop.role ?? "",
        referredBy: shop.referredBy,
        nextStep: shop.nextStep ?? "",
        outcome: resolveOutcome(shop),
        formattedAddress: buildLocationSearchText(location, shop.address),
      }),
      updatedAt: Date.now(),
    });
  },
});

export const updateShopLead = mutation({
  args: {
    shopId: v.id("shops"),
    contactPerson: v.string(),
    name: v.string(),
    nextStep: v.optional(v.string()),
    phone: v.string(),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const shop = await ctx.db.get(args.shopId);

    if (!shop) {
      throw new Error("Lead not found.");
    }

    const name = normalizeText(args.name);
    const phone = normalizePhone(args.phone);
    const contactPerson = normalizeText(args.contactPerson);
    const role = normalizeText(args.role ?? "");
    const nextStep = normalizeText(args.nextStep ?? "");
    const location = resolveLocation(shop);
    const neighborhood = resolveNeighborhood(shop, location);

    if (!name) {
      throw new Error("Lead name is required.");
    }

    await ctx.db.patch(args.shopId, {
      contactPerson,
      name,
      nextStep,
      normalizedName: normalizeIndexText(name),
      phone,
      role,
      searchText: toSearchTextInput({
        category: resolveCategory(shop),
        mission: resolveMission(shop),
        name,
        neighborhood,
        phone,
        contactPerson,
        role,
        referredBy: shop.referredBy,
        nextStep,
        outcome: resolveOutcome(shop),
        formattedAddress: buildLocationSearchText(location, shop.address),
      }),
      updatedAt: Date.now(),
    });
  },
});

export const deleteShopLead = mutation({
  args: {
    shopId: v.id("shops"),
  },
  handler: async (ctx, args) => {
    const shop = await ctx.db.get(args.shopId);

    if (!shop) {
      return;
    }

    await ctx.db.delete(args.shopId);
  },
});

export const findPotentialDuplicates = query({
  args: {
    name: v.string(),
    neighborhood: v.string(),
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedName = normalizeIndexText(args.name);
    const normalizedNeighborhood = normalizeIndexText(args.neighborhood);
    const normalizedPhone = normalizePhone(args.phone);
    const matches = new Map<Id<"shops">, Doc<"shops">>();

    if (normalizedPhone) {
      const phoneMatches = await ctx.db
        .query("shops")
        .withIndex("by_normalized_phone", (q) => q.eq("normalizedPhone", normalizedPhone))
        .take(5);

      for (const shop of phoneMatches) {
        matches.set(shop._id, shop);
      }
    }

    if (normalizedName && normalizedNeighborhood) {
      const nameMatches = await ctx.db
        .query("shops")
        .withIndex("by_normalized_name_and_normalized_neighborhood", (q) =>
          q.eq("normalizedName", normalizedName).eq("normalizedNeighborhood", normalizedNeighborhood),
        )
        .take(5);

      for (const shop of nameMatches) {
        matches.set(shop._id, shop);
      }
    }

    return [...matches.values()]
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, 5)
      .map((shop) => ({
        _id: shop._id,
        category: resolveCategory(shop),
        mission: resolveMission(shop),
        name: shop.name,
        neighborhood: resolveNeighborhood(shop, resolveLocation(shop)),
        phone: shop.phone,
        outcome: resolveOutcome(shop),
        createdAt: shop.createdAt,
      }));
  },
});

export const listMissionFeed = query({
  args: {
    limit: v.number(),
    mission: v.string(),
  },
  handler: async (ctx, args) => {
    const mission = normalizeMission(args.mission);
    const limit = Math.max(1, Math.min(args.limit, MAX_FEED_RESULTS));
    const shops = await ctx.db
      .query("shops")
      .withIndex("by_mission_and_createdAt", (q) => q.eq("mission", mission))
      .order("desc")
      .take(limit);

    return await Promise.all(shops.map((shop) => toShopSummary(ctx, shop)));
  },
});

export const listMissionMapPins = query({
  args: {
    mission: v.string(),
    category: v.optional(v.string()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const mission = normalizeMission(args.mission);
    const category = args.category ? normalizeCategory(args.category) : null;
    const limit = Math.max(1, Math.min(args.limit, MAX_FEED_RESULTS));
    const candidateShops = await ctx.db
      .query("shops")
      .withIndex("by_mission_and_createdAt", (q) => q.eq("mission", mission))
      .order("desc")
      .take(category ? MAX_FEED_SCAN : limit);

    const pins = [];

    for (const shop of candidateShops) {
      if (category && resolveCategory(shop) !== category) {
        continue;
      }

      pins.push(toMapPin(shop));

      if (pins.length >= limit) {
        break;
      }
    }

    return pins;
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
      role: shop.role,
      referredBy: shop.referredBy,
      nextStep: shop.nextStep,
      outcome: resolveOutcome(shop),
      images,
      location,
      createdAt: shop.createdAt,
      updatedAt: shop.updatedAt ?? shop.createdAt,
    };
  },
});
