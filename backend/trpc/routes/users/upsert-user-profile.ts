import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";
import { upsertUserProfile, UserProfileRecord, findUserById } from "./user-store";

export default publicProcedure
  .input(
    z.object({
      id: z.string(),
      email: z.string(),
      name: z.string(),
      username: z.string().nullable().optional(),
      shareCookbookWithFriends: z.boolean().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const now = new Date().toISOString();
    const username = (input.username || input.email.split("@")[0] || "").toLowerCase();

    const existing = await findUserById(input.id);

    const profile: UserProfileRecord = {
      id: input.id,
      email: input.email,
      username,
      displayName: input.name || username || input.email,
      shareCookbookWithFriends: input.shareCookbookWithFriends ?? false,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    const saved = await upsertUserProfile(profile);

    console.log("🔥 BACKEND UPSERT USER PROFILE (JSON store):", {
      ...saved,
    });

    return { success: true, profile: saved };
  });
