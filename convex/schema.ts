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
    referredBy: v.string(),
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
    .index("by_neighborhood_and_createdAt", ["neighborhood", "createdAt"]),
});
