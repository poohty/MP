import { publicProcedure } from "@/backend/trpc/create-context";
import { loadAllUserProfiles } from "./user-store";

export default publicProcedure.query(async () => {
  const allProfiles = await loadAllUserProfiles();

  console.log("📊 BACKEND GET ALL USERS (JSON store):", {
    totalCount: allProfiles.length,
    users: allProfiles.map((p) => ({
      id: p.id,
      username: p.username,
      email: p.email,
      displayName: p.displayName,
    })),
  });

  return {
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
