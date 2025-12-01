import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";
import { searchUsersByUsername, loadAllUserProfiles } from "./user-store";

export default publicProcedure
  .input(
    z.object({
      query: z.string(),
      excludeUserId: z.string().optional(),
    })
  )
  .query(async ({ input }) => {
    const normalized = input.query.trim().toLowerCase();

    const allProfiles = await loadAllUserProfiles();

    console.log("🔍 BACKEND SEARCH USERS:", {
      query: input.query,
      normalized,
      excludeUserId: input.excludeUserId,
      totalProfilesInBackend: allProfiles.length,
    });

    if (!normalized || normalized.length < 2) {
      console.log("🔍 BACKEND: Query too short, returning empty list");
      return [];
    }

    const matches = await searchUsersByUsername(normalized, input.excludeUserId);

    console.log("🔍 BACKEND: Search results count:", matches.length);
    console.log(
      "🔍 BACKEND: Search results:",
      matches.map((r) => `${r.username} (${r.id})`).join(", ")
    );

    return matches.map((profile) => ({
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      shareCookbookWithFriends: profile.shareCookbookWithFriends,
    }));
  });
