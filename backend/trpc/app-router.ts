import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import proxyImageRoute from "./routes/proxy-image/route";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  proxyImage: proxyImageRoute,
});

export type AppRouter = typeof appRouter;
