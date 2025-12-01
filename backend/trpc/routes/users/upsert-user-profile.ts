import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";

type UserProfileRecord = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  shareCookbookWithFriends: boolean;
  createdAt: string;
  updatedAt: string;
};

const userProfiles = new Map<string, UserProfileRecord>();

export default publicProcedure
  .input(
    z.object({
      id: z.string(),
      email: z.string(),
      name: z.string(),
      username: z.string().optional(),
      shareCookbookWithFriends: z.boolean().optional(),
    })
  )
  .mutation(({ input }) => {
    const username = (input.username || input.email.split('@')[0]).trim().toLowerCase();
    
    const existing = userProfiles.get(input.id);
    
    const profile: UserProfileRecord = {
      id: input.id,
      email: input.email,
      username,
      displayName: input.name || username,
      shareCookbookWithFriends: input.shareCookbookWithFriends ?? false,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    userProfiles.set(input.id, profile);

    console.log('🔥 BACKEND UPSERT USER PROFILE:', {
      id: profile.id,
      email: profile.email,
      username: profile.username,
      displayName: profile.displayName,
      shareCookbookWithFriends: profile.shareCookbookWithFriends,
      totalProfilesInBackend: userProfiles.size,
    });

    return { success: true, profile };
  });

export { userProfiles };
