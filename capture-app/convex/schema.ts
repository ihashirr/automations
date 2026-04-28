import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  shops: defineTable({
    category: v.string(),
    name: v.string(),
    mission: v.string(),
    neighborhood: v.string(),
    phone: v.string(),
    contactPerson: v.string(),
    role: v.optional(v.string()),
    referredBy: v.string(),
    nextStep: v.optional(v.string()),
    outcome: v.optional(v.string()),
    normalizedName: v.optional(v.string()),
    normalizedNeighborhood: v.optional(v.string()),
    normalizedPhone: v.optional(v.string()),
    // Current: Cloudinary URLs.
    // Legacy: Convex storage ids from the original implementation.
    images: v.union(v.array(v.string()), v.array(v.id("_storage"))),
    // Deprecated: keep old string-based field readable until records are cleaned up.
    imageUrls: v.optional(v.array(v.string())),
    searchText: v.optional(v.string()),
    location: v.object({
      lat: v.number(),
      lng: v.number(),
      formattedAddress: v.string(),
      addressLabel: v.optional(v.string()),
    }),
    // Deprecated: keep legacy flat location fields readable until old data is cleaned up.
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    address: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_category_and_createdAt", ["category", "createdAt"])
    .index("by_mission_and_createdAt", ["mission", "createdAt"])
    .index("by_mission_category_createdAt", ["mission", "category", "createdAt"])
    .index("by_neighborhood_and_createdAt", ["neighborhood", "createdAt"])
    .index("by_normalized_phone", ["normalizedPhone"])
    .index("by_normalized_name_and_normalized_neighborhood", ["normalizedName", "normalizedNeighborhood"]),
  missionFolders: defineTable({
    folderId: v.string(),
    isDeleted: v.boolean(),
    label: v.string(),
    missionId: v.string(),
    missionLabel: v.string(),
    normalizedLabel: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_mission_and_deleted", ["missionId", "isDeleted"])
    .index("by_mission_and_folder", ["missionId", "folderId"])
    .index("by_mission_and_normalized_label", ["missionId", "normalizedLabel"]),
  missionProfiles: defineTable({
    isDeleted: v.boolean(),
    label: v.string(),
    missionId: v.string(),
    normalizedLabel: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_deleted", ["isDeleted"])
    .index("by_mission", ["missionId"])
    .index("by_normalized_label", ["normalizedLabel"]),
});
