import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeIndexText(value: string) {
  return normalizeText(value).toLowerCase();
}

export const listMissionProfiles = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("missionProfiles").collect();

    return rows.map((row) => ({
      isDeleted: row.isDeleted,
      label: row.label,
      missionId: row.missionId,
    }));
  },
});

export const deleteMissionProfile = mutation({
  args: {
    label: v.string(),
    missionId: v.string(),
  },
  handler: async (ctx, args) => {
    const label = normalizeText(args.label);

    if (!label) {
      throw new Error("Mission name is required.");
    }

    const now = Date.now();
    const existingRows = await ctx.db
      .query("missionProfiles")
      .withIndex("by_mission", (q) => q.eq("missionId", args.missionId))
      .take(1);
    const existing = existingRows[0];

    if (existing) {
      await ctx.db.patch(existing._id, {
        isDeleted: true,
        label,
        normalizedLabel: normalizeIndexText(label),
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("missionProfiles", {
        createdAt: now,
        isDeleted: true,
        label,
        missionId: args.missionId,
        normalizedLabel: normalizeIndexText(label),
        updatedAt: now,
      });
    }

    return { missionId: args.missionId };
  },
});
