import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";
import { userProfiles } from "./upsert-user-profile";

export default publicProcedure
  .input(
    z.object({
      userId: z.string(),
    })
  )
  .query(({ input }) => {
    console.log('🔍 BACKEND GET USER PROFILE:', input.userId);
    
    const profile = userProfiles.get(input.userId);
    
    if (!profile) {
      console.log('🔍 BACKEND: Profile not found for', input.userId);
      return null;
    }

    console.log('🔍 BACKEND: Profile found:', profile.username);

    return {
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      shareCookbookWithFriends: profile.shareCookbookWithFriends,
    };
  });
