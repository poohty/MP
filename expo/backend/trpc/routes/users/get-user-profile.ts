import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";
import { findUserById } from "./user-store";

export default publicProcedure
  .input(
    z.object({
      userId: z.string(),
    })
  )
  .query(async ({ input }) => {
    const profile = await findUserById(input.userId);

    if (!profile) {
      console.log("🔍 BACKEND: Profile not found for", input.userId);
      return null;
    }

    console.log("🔍 BACKEND: Profile found:", profile.username);

    return {
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      shareCookbookWithFriends: profile.shareCookbookWithFriends,
    };
  });
