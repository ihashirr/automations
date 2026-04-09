import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  defaultMission,
  getCategoryDefinition,
  getMissionDefinition,
  MissionCategoryDefinition,
} from "../constants/missions";

const STORAGE_KEY_MISSION = "capture-app:active-mission";
const STORAGE_KEY_CATEGORY = "capture-app:active-category";
const STORAGE_KEY_CUSTOM = "capture-app:custom-categories";

type MissionControlContextValue = {
  activeCategoryId: string | null;
  activeCategoryLabel: string | null;
  activeMissionId: string;
  activeMissionLabel: string;
  addMissionCategory: (options: { label: string; missionId?: string }) => MissionCategoryDefinition | null;
  getCategoryById: (
    missionId: string | null | undefined,
    categoryId: string | null | undefined,
  ) => MissionCategoryDefinition | null;
  getCategoryIdFromLabel: (
    missionId: string | null | undefined,
    categoryLabel: string | null | undefined,
  ) => string | null;
  getMissionCategories: (missionId?: string | null) => MissionCategoryDefinition[];
  setActiveCategoryId: (categoryId: string | null) => void;
  setActiveMissionId: (missionId: string) => void;
  startCategoryMission: (options: { categoryId: string; missionId?: string }) => void;
};

const MissionControlContext = createContext<MissionControlContextValue | null>(null);

export function MissionControlProvider({ children }: { children: ReactNode }) {
  const [activeMissionId, setActiveMissionIdState] = useState(defaultMission.id);
  const [activeCategoryId, setActiveCategoryIdState] = useState<string | null>(null);
  const [customCategoriesByMission, setCustomCategoriesByMission] = useState<
    Record<string, MissionCategoryDefinition[]>
  >({});
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function loadStoredState() {
      try {
        const [storedMission, storedCategory, storedCustom] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_MISSION),
          AsyncStorage.getItem(STORAGE_KEY_CATEGORY),
          AsyncStorage.getItem(STORAGE_KEY_CUSTOM),
        ]);

        if (storedMission) {
          setActiveMissionIdState(storedMission);
        }
        if (storedCategory) {
          setActiveCategoryIdState(storedCategory);
        }
        if (storedCustom) {
          setCustomCategoriesByMission(JSON.parse(storedCustom));
        }
      } catch (error) {
        console.error("Failed to load stored mission state:", error);
      } finally {
        setIsReady(true);
      }
    }

    loadStoredState();
  }, []);

  useEffect(() => {
    if (!isReady) return;

    void AsyncStorage.setItem(STORAGE_KEY_MISSION, activeMissionId);
    if (activeCategoryId) {
      void AsyncStorage.setItem(STORAGE_KEY_CATEGORY, activeCategoryId);
    } else {
      void AsyncStorage.removeItem(STORAGE_KEY_CATEGORY);
    }
    void AsyncStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(customCategoriesByMission));
  }, [activeMissionId, activeCategoryId, customCategoriesByMission, isReady]);

  const value = useMemo<MissionControlContextValue>(() => {
    const getMissionCategories = (missionId?: string | null) => {
      const mission = getMissionDefinition(missionId ?? activeMissionId);
      const customCategories = customCategoriesByMission[mission.id] ?? [];
      return [...mission.categories, ...customCategories];
    };

    const getCategoryById = (
      missionId: string | null | undefined,
      categoryId: string | null | undefined,
    ) => {
      if (!categoryId) {
        return null;
      }

      return (
        getMissionCategories(missionId).find((category) => category.id === categoryId) ??
        getCategoryDefinition(missionId, categoryId)
      );
    };

    const getCategoryIdFromLabel = (
      missionId: string | null | undefined,
      categoryLabel: string | null | undefined,
    ) => {
      const normalizedLabel = categoryLabel?.trim().toLowerCase();

      if (!normalizedLabel) {
        return null;
      }

      return (
        getMissionCategories(missionId).find(
          (category) => category.label.toLowerCase() === normalizedLabel,
        )?.id ?? null
      );
    };

    const mission = getMissionDefinition(activeMissionId);
    const category = getCategoryById(activeMissionId, activeCategoryId);

    return {
      activeCategoryId,
      activeCategoryLabel: category?.label ?? null,
      activeMissionId: mission.id,
      activeMissionLabel: mission.label,
      addMissionCategory: ({ label, missionId }) => {
        const trimmedLabel = label.trim();

        if (!trimmedLabel) {
          return null;
        }

        const targetMission = getMissionDefinition(missionId ?? activeMissionId);
        const normalizedLabel = trimmedLabel.toLowerCase();
        const existingCategory = getMissionCategories(targetMission.id).find(
          (categoryDefinition) => categoryDefinition.label.toLowerCase() === normalizedLabel,
        );

        if (existingCategory) {
          return existingCategory;
        }

        const slugBase = trimmedLabel
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") || "folder";
        const nextId = `custom-${slugBase}-${Date.now()}`;
        const nextCategory = { id: nextId, label: trimmedLabel };

        setCustomCategoriesByMission((current) => ({
          ...current,
          [targetMission.id]: [...(current[targetMission.id] ?? []), nextCategory],
        }));

        return nextCategory;
      },
      getCategoryById,
      getCategoryIdFromLabel,
      getMissionCategories,
      setActiveCategoryId: (categoryId) => {
        setActiveCategoryIdState(categoryId);
      },
      setActiveMissionId: (missionId) => {
        const nextMission = getMissionDefinition(missionId);
        setActiveMissionIdState(nextMission.id);
        setActiveCategoryIdState(null);
      },
      startCategoryMission: ({ categoryId, missionId }) => {
        const nextMission = getMissionDefinition(missionId ?? activeMissionId);
        setActiveMissionIdState(nextMission.id);
        setActiveCategoryIdState(categoryId);
      },
    };
  }, [activeCategoryId, activeMissionId, customCategoriesByMission]);

  if (!isReady) {
    return null;
  }

  return <MissionControlContext.Provider value={value}>{children}</MissionControlContext.Provider>;
}

export function useMissionControl() {
  const context = useContext(MissionControlContext);

  if (!context) {
    throw new Error("useMissionControl must be used inside MissionControlProvider.");
  }

  return context;
}
