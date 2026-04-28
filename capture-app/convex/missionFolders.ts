import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_FALLBACK_CATEGORY = "Unsorted";
const MAX_RECLASSIFY_PER_DELETE = 500;

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeIndexText(value: string) {
  return normalizeText(value).toLowerCase();
}

function slugify(value: string) {
  return (
    normalizeIndexText(value)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "folder"
  );
}

function buildSearchText(fields: {
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

function locationSearchText(shop: { address?: string; location?: { formattedAddress: string; addressLabel?: string } }) {
  return [shop.location?.addressLabel, shop.location?.formattedAddress, shop.address]
    .map((value) => normalizeText(value ?? ""))
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(" ");
}

export const listMissionFolders = query({
  args: {
    missionId: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("missionFolders")
      .withIndex("by_mission_and_deleted", (q) => q.eq("missionId", args.missionId))
      .collect();

    return rows.map((row) => ({
      folderId: row.folderId,
      isDeleted: row.isDeleted,
      label: row.label,
      missionId: row.missionId,
    }));
  },
});

export const createMissionFolder = mutation({
  args: {
    folderId: v.optional(v.string()),
    label: v.string(),
    missionId: v.string(),
    missionLabel: v.string(),
  },
  handler: async (ctx, args) => {
    const label = normalizeText(args.label);

    if (!label) {
      throw new Error("Folder name is required.");
    }

    const normalizedLabel = normalizeIndexText(label);
    const existingRows = await ctx.db
      .query("missionFolders")
      .withIndex("by_mission_and_normalized_label", (q) =>
        q.eq("missionId", args.missionId).eq("normalizedLabel", normalizedLabel),
      )
      .take(1);
    const existing = existingRows[0];
    const now = Date.now();

    if (existing) {
      if (existing.isDeleted) {
        await ctx.db.patch(existing._id, {
          isDeleted: false,
          label,
          missionLabel: normalizeText(args.missionLabel),
          updatedAt: now,
        });
      }

      return {
        folderId: existing.folderId,
        label: existing.isDeleted ? label : existing.label,
        missionId: existing.missionId,
      };
    }

    const folderId = normalizeText(args.folderId ?? "") || `custom-${slugify(label)}-${now}`;
    await ctx.db.insert("missionFolders", {
      createdAt: now,
      folderId,
      isDeleted: false,
      label,
      missionId: args.missionId,
      missionLabel: normalizeText(args.missionLabel),
      normalizedLabel,
      updatedAt: now,
    });

    return {
      folderId,
      label,
      missionId: args.missionId,
    };
  },
});

export const deleteMissionFolder = mutation({
  args: {
    fallbackCategory: v.optional(v.string()),
    folderId: v.string(),
    label: v.string(),
    missionId: v.string(),
    missionLabel: v.string(),
  },
  handler: async (ctx, args) => {
    const label = normalizeText(args.label);
    const missionLabel = normalizeText(args.missionLabel);
    const fallbackCategory = normalizeText(args.fallbackCategory ?? DEFAULT_FALLBACK_CATEGORY);

    if (!label) {
      throw new Error("Folder name is required.");
    }

    if (normalizeIndexText(label) === normalizeIndexText(fallbackCategory)) {
      throw new Error("The fallback folder cannot be deleted.");
    }

    const now = Date.now();
    const existingRows = await ctx.db
      .query("missionFolders")
      .withIndex("by_mission_and_folder", (q) =>
        q.eq("missionId", args.missionId).eq("folderId", args.folderId),
      )
      .take(1);
    const existing = existingRows[0];

    if (existing) {
      await ctx.db.patch(existing._id, {
        isDeleted: true,
        label,
        missionLabel,
        normalizedLabel: normalizeIndexText(label),
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("missionFolders", {
        createdAt: now,
        folderId: args.folderId,
        isDeleted: true,
        label,
        missionId: args.missionId,
        missionLabel,
        normalizedLabel: normalizeIndexText(label),
        updatedAt: now,
      });
    }

    const affectedShops = await ctx.db
      .query("shops")
      .withIndex("by_mission_category_createdAt", (q) =>
        q.eq("mission", missionLabel).eq("category", label),
      )
      .take(MAX_RECLASSIFY_PER_DELETE);

    for (const shop of affectedShops) {
      await ctx.db.patch(shop._id, {
        category: fallbackCategory,
        searchText: buildSearchText({
          category: fallbackCategory,
          mission: missionLabel,
          name: shop.name,
          neighborhood: shop.neighborhood,
          phone: shop.phone,
          contactPerson: shop.contactPerson,
          role: shop.role ?? "",
          referredBy: shop.referredBy,
          nextStep: shop.nextStep ?? "",
          outcome: shop.outcome ?? "unknown",
          formattedAddress: locationSearchText(shop),
        }),
        updatedAt: now,
      });
    }

    return {
      movedCount: affectedShops.length,
    };
  },
});
