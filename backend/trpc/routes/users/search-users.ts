import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";
import { userProfiles } from "./upsert-user-profile";

export default publicProcedure
  .input(
    z.object({
      query: z.string(),
      excludeUserId: z.string().optional(),
    })
  )
  .query(({ input }) => {
    const normalized = input.query.trim().toLowerCase();

    console.log('🔍 BACKEND SEARCH USERS:', {
      query: input.query,
      normalized,
      excludeUserId: input.excludeUserId,
      totalProfilesInBackend: userProfiles.size,
    });

    if (!normalized || normalized.length < 2) {
      console.log('🔍 BACKEND: Query too short, returning empty results');
      return [];
    }

    const allProfiles = Array.from(userProfiles.values());
    console.log('🔍 BACKEND: All profiles:', allProfiles.map(p => `${p.username} (${p.id})`).join(', '));

    const results = allProfiles
      .filter((profile) => {
        const isNotExcluded = !input.excludeUserId || profile.id !== input.excludeUserId;
        const matchesUsername = profile.username.toLowerCase().includes(normalized);
        const matchesDisplayName = profile.displayName.toLowerCase().includes(normalized);
        
        const matches = isNotExcluded && (matchesUsername || matchesDisplayName);
        
        console.log(`🔍 BACKEND: Checking ${profile.username}:`, {
          isNotExcluded,
          matchesUsername,
          matchesDisplayName,
          matches,
        });
        
        return matches;
      })
      .map((profile) => ({
        id: profile.id,
        username: profile.username,
        displayName: profile.displayName,
        shareCookbookWithFriends: profile.shareCookbookWithFriends,
      }));

    console.log('🔍 BACKEND: Search results count:', results.length);
    console.log('🔍 BACKEND: Search results:', results.map(r => `${r.username} (${r.id})`).join(', '));

    return results;
  });
