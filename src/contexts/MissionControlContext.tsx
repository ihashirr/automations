import { createContext, ReactNode, useContext, useMemo, useState } from "react";
import {
  defaultMission,
  getCategoryDefinition,
  getMissionDefinition,
} from "../constants/missions";

type MissionControlContextValue = {
  activeCategoryId: string | null;
  activeCategoryLabel: string | null;
  activeMissionId: string;
  activeMissionLabel: string;
  setActiveCategoryId: (categoryId: string | null) => void;
  setActiveMissionId: (missionId: string) => void;
  startCategoryMission: (options: { categoryId: string; missionId?: string }) => void;
};

const MissionControlContext = createContext<MissionControlContextValue | null>(null);

export function MissionControlProvider({ children }: { children: ReactNode }) {
  const [activeMissionId, setActiveMissionIdState] = useState(defaultMission.id);
  const [activeCategoryId, setActiveCategoryIdState] = useState<string | null>(null);

  const value = useMemo<MissionControlContextValue>(() => {
    const mission = getMissionDefinition(activeMissionId);
    const category = getCategoryDefinition(activeMissionId, activeCategoryId);

    return {
      activeCategoryId,
      activeCategoryLabel: category?.label ?? null,
      activeMissionId: mission.id,
      activeMissionLabel: mission.label,
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
  }, [activeCategoryId, activeMissionId]);

  return <MissionControlContext.Provider value={value}>{children}</MissionControlContext.Provider>;
}

export function useMissionControl() {
  const context = useContext(MissionControlContext);

  if (!context) {
    throw new Error("useMissionControl must be used inside MissionControlProvider.");
  }

  return context;
}
