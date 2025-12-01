import { publicProcedure } from "@/backend/trpc/create-context";
import { loadAllUserProfiles } from "./user-store";
import { BACKEND_INSTANCE_ID } from "@/backend/hono";

export default publicProcedure.query(async () => {
  const allProfiles = await loadAllUserProfiles();

  console.log("📊 BACKEND GET ALL USERS:", {
    backendInstanceId: BACKEND_INSTANCE_ID,
    totalCount: allProfiles.length,
    users: allProfiles.map((p) => ({
      id: p.id,
      username: p.username,
      email: p.email,
      displayName: p.displayName,
    })),
  });

  return {
    backendInstanceId: BACKEND_INSTANCE_ID,
    total: allProfiles.length,
    users: allProfiles.map((profile) => ({
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      email: profile.email,
      shareCookbookWithFriends: profile.shareCookbookWithFriends,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    })),
  };
});
