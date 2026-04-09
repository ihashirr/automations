export type MissionCategoryDefinition = {
  id: string;
  label: string;
};

export type MissionDefinition = {
  id: string;
  label: string;
  categories: MissionCategoryDefinition[];
};

export const missionCatalog: MissionDefinition[] = [
  {
    id: "sme",
    label: "SME",
    categories: [
      { id: "perfume-shops", label: "Perfume Shops" },
      { id: "groceries", label: "Groceries" },
      { id: "cafes", label: "Cafes" },
      { id: "unsorted", label: "Unsorted" },
    ],
  },
];

export const defaultMission = missionCatalog[0];

export function getMissionDefinition(missionId: string | null | undefined) {
  return missionCatalog.find((mission) => mission.id === missionId) ?? defaultMission;
}

export function getCategoryDefinition(
  missionId: string | null | undefined,
  categoryId: string | null | undefined,
) {
  const mission = getMissionDefinition(missionId);

  return mission.categories.find((category) => category.id === categoryId) ?? null;
}

export function getCategoryIdFromLabel(
  missionId: string | null | undefined,
  categoryLabel: string | null | undefined,
) {
  const normalizedLabel = categoryLabel?.trim().toLowerCase();

  if (!normalizedLabel) {
    return null;
  }

  return (
    getMissionDefinition(missionId).categories.find(
      (category) => category.label.toLowerCase() === normalizedLabel,
    )?.id ?? null
  );
}
