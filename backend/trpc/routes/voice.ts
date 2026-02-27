import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";

export default publicProcedure
  .input(z.object({ text: z.string() }))
  .mutation(({ input }) => {
    return {
      text: input.text,
      processedAt: new Date(),
    };
  });
