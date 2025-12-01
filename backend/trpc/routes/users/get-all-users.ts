import { publicProcedure } from "@/backend/trpc/create-context";
import { userProfiles } from "./upsert-user-profile";

export default publicProcedure.query(() => {
  const allProfiles = Array.from(userProfiles.values());
  
  console.log('📊 BACKEND GET ALL USERS:', {
    totalCount: allProfiles.length,
    users: allProfiles.map(p => ({
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
