import { Id } from "../../convex/_generated/dataModel";

export type HomeTabParamList = {
  Missions: undefined;
  Capture: undefined;
  Map: undefined;
};

export type RootStackParamList = {
  Home: undefined;
  ShopDetail: {
    shopId: Id<"shops">;
  };
};
