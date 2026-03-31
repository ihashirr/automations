import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  shops: defineTable({
    name: v.string(),
    phone: v.string(),
    contactPerson: v.string(),
    referredBy: v.string(),
    imageUrls: v.optional(v.array(v.string())),
    // Deprecated: keep legacy Convex storage ids readable until old data is cleaned up.
    images: v.optional(v.array(v.id("_storage"))),
    searchText: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    address: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  }).index("by_createdAt", ["createdAt"]),
});
