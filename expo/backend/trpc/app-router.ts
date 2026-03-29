import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import upsertUserProfileRoute from "./routes/users/upsert-user-profile";
import searchUsersRoute from "./routes/users/search-users";
import getUserProfileRoute from "./routes/users/get-user-profile";
import getAllUsersRoute from "./routes/users/get-all-users";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  users: createTRPCRouter({
    upsertUserProfile: upsertUserProfileRoute,
    searchUsers: searchUsersRoute,
    getUserProfile: getUserProfileRoute,
    getAllUsers: getAllUsersRoute,
  }),
});

export type AppRouter = typeof appRouter;
