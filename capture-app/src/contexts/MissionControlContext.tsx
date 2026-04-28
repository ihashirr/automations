import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  defaultMission,
  getCategoryDefinition,
  getMissionDefinition,
  missionCatalog,
  MissionCategoryDefinition,
  MissionDefinition,
} from "../constants/missions";

const STORAGE_KEY_MISSION = "capture-app:active-mission";
const STORAGE_KEY_CATEGORY = "capture-app:active-category";
const STORAGE_KEY_CUSTOM = "capture-app:custom-categories";
const STORAGE_KEY_DELETED_MISSIONS = "capture-app:deleted-missions";

type MissionControlContextValue = {
  activeCategoryId: string | null;
  activeCategoryLabel: string | null;
  activeMissionId: string;
  activeMissionLabel: string;
  addMissionCategory: (options: { label: string; missionId?: string }) => MissionCategoryDefinition | null;
  deleteMissionProfile: (options: {
    label: string;
    missionId: string;
  }) => Promise<{ missionId: string } | null>;
  deleteMissionCategory: (options: {
    categoryId: string;
    label: string;
    missionId?: string;
  }) => Promise<{ movedCount: number } | null>;
  getCategoryById: (
    missionId: string | null | undefined,
    categoryId: string | null | undefined,
  ) => MissionCategoryDefinition | null;
  getCategoryIdFromLabel: (
    missionId: string | null | undefined,
    categoryLabel: string | null | undefined,
  ) => string | null;
  getMissionCategories: (missionId?: string | null) => MissionCategoryDefinition[];
  getMissionProfiles: () => MissionDefinition[];
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
  const [deletedMissionIds, setDeletedMissionIds] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);
  const remoteMissionProfiles = useQuery(api.missionProfiles.listMissionProfiles, {});
  const remoteMissionFolders = useQuery(api.missionFolders.listMissionFolders, {
    missionId: activeMissionId,
  });
  const deleteRemoteMissionProfile = useMutation(api.missionProfiles.deleteMissionProfile);
  const createRemoteMissionFolder = useMutation(api.missionFolders.createMissionFolder);
  const deleteRemoteMissionFolder = useMutation(api.missionFolders.deleteMissionFolder);

  useEffect(() => {
    async function loadStoredState() {
      try {
        const [storedMission, storedCategory, storedCustom, storedDeletedMissions] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_MISSION),
          AsyncStorage.getItem(STORAGE_KEY_CATEGORY),
          AsyncStorage.getItem(STORAGE_KEY_CUSTOM),
          AsyncStorage.getItem(STORAGE_KEY_DELETED_MISSIONS),
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
        if (storedDeletedMissions) {
          setDeletedMissionIds(JSON.parse(storedDeletedMissions));
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
    void AsyncStorage.setItem(STORAGE_KEY_DELETED_MISSIONS, JSON.stringify(deletedMissionIds));
  }, [activeMissionId, activeCategoryId, customCategoriesByMission, deletedMissionIds, isReady]);

  const value = useMemo<MissionControlContextValue>(() => {
    const remoteDeletedMissionIds = new Set(
      (remoteMissionProfiles ?? [])
        .filter((profile) => profile.isDeleted)
        .map((profile) => profile.missionId),
    );
    const locallyDeletedMissionIds = new Set(deletedMissionIds);
    const getMissionProfiles = () =>
      missionCatalog.filter(
        (mission) =>
          !remoteDeletedMissionIds.has(mission.id) &&
          !locallyDeletedMissionIds.has(mission.id),
      );
    const getAvailableMissionDefinition = (missionId: string | null | undefined) => {
      const availableMissions = getMissionProfiles();

      return (
        availableMissions.find((mission) => mission.id === missionId) ??
        availableMissions[0] ??
        getMissionDefinition(missionId)
      );
    };

    const getMissionCategories = (missionId?: string | null) => {
      const mission = getAvailableMissionDefinition(missionId ?? activeMissionId);
      const remoteRows = mission.id === activeMissionId ? remoteMissionFolders ?? [] : [];
      const deletedRows = remoteRows.filter((row) => row.isDeleted);
      const remoteActiveRows = remoteRows.filter((row) => !row.isDeleted);
      const customCategories = customCategoriesByMission[mission.id] ?? [];
      const deletedLabels = new Set(deletedRows.map((row) => row.label.toLowerCase()));
      const deletedFolderIds = new Set(deletedRows.map((row) => row.folderId));
      const mergedCategories = [
        ...mission.categories.filter(
          (category) =>
            !deletedFolderIds.has(category.id) &&
            !deletedLabels.has(category.label.toLowerCase()),
        ),
        ...customCategories.filter(
          (category) =>
            !deletedFolderIds.has(category.id) &&
            !deletedLabels.has(category.label.toLowerCase()),
        ),
      ];

      for (const remoteCategory of remoteActiveRows) {
        const exists = mergedCategories.some(
          (category) =>
            category.id === remoteCategory.folderId ||
            category.label.toLowerCase() === remoteCategory.label.toLowerCase(),
        );

        if (!exists) {
          mergedCategories.push({ id: remoteCategory.folderId, label: remoteCategory.label });
        }
      }

      return mergedCategories;
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

    const mission = getAvailableMissionDefinition(activeMissionId);
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

        const targetMission = getAvailableMissionDefinition(missionId ?? activeMissionId);
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
        void createRemoteMissionFolder({
          folderId: nextId,
          label: trimmedLabel,
          missionId: targetMission.id,
          missionLabel: targetMission.label,
        }).catch((error) => {
          console.error("Failed to create mission folder:", error);
        });

        return nextCategory;
      },
      deleteMissionProfile: async ({ label, missionId }) => {
        const normalizedMissionId = getMissionDefinition(missionId).id;

        setDeletedMissionIds((current) =>
          current.includes(normalizedMissionId) ? current : [...current, normalizedMissionId],
        );

        if (activeMissionId === normalizedMissionId) {
          const nextMission = getMissionProfiles().find((missionOption) => missionOption.id !== normalizedMissionId);
          setActiveMissionIdState(nextMission?.id ?? defaultMission.id);
          setActiveCategoryIdState(null);
        }

        return await deleteRemoteMissionProfile({
          label,
          missionId: normalizedMissionId,
        });
      },
      deleteMissionCategory: async ({ categoryId, label, missionId }) => {
        const targetMission = getAvailableMissionDefinition(missionId ?? activeMissionId);

        if (label.trim().toLowerCase() === "unsorted") {
          return null;
        }

        setCustomCategoriesByMission((current) => ({
          ...current,
          [targetMission.id]: (current[targetMission.id] ?? []).filter(
            (category) => category.id !== categoryId && category.label.toLowerCase() !== label.toLowerCase(),
          ),
        }));

        if (activeMissionId === targetMission.id && activeCategoryId === categoryId) {
          setActiveCategoryIdState(null);
        }

        return await deleteRemoteMissionFolder({
          fallbackCategory: "Unsorted",
          folderId: categoryId,
          label,
          missionId: targetMission.id,
          missionLabel: targetMission.label,
        });
      },
      getCategoryById,
      getCategoryIdFromLabel,
      getMissionCategories,
      getMissionProfiles,
      setActiveCategoryId: (categoryId) => {
        setActiveCategoryIdState(categoryId);
      },
      setActiveMissionId: (missionId) => {
        const nextMission = getAvailableMissionDefinition(missionId);
        setActiveMissionIdState(nextMission.id);
        setActiveCategoryIdState(null);
      },
      startCategoryMission: ({ categoryId, missionId }) => {
        const nextMission = getAvailableMissionDefinition(missionId ?? activeMissionId);
        setActiveMissionIdState(nextMission.id);
        setActiveCategoryIdState(categoryId);
      },
    };
  }, [
    activeCategoryId,
    activeMissionId,
    createRemoteMissionFolder,
    customCategoriesByMission,
    deleteRemoteMissionProfile,
    deleteRemoteMissionFolder,
    deletedMissionIds,
    remoteMissionFolders,
    remoteMissionProfiles,
  ]);

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
