import { publicProcedure } from "@/backend/trpc/create-context";
import { loadAllUserProfiles } from "./user-store";
import { BACKEND_INSTANCE_ID, BACKEND_START_TIME } from "@/backend/hono";

export default publicProcedure.query(async () => {
  const allProfiles = await loadAllUserProfiles();

  console.log("📊 ======== BACKEND GET ALL USERS ========");
  console.log("📊 Backend Instance ID:", BACKEND_INSTANCE_ID);
  console.log("📊 Backend Start Time:", BACKEND_START_TIME);
  console.log("📊 Process PID:", process.pid);
  console.log("📊 Total User Count:", allProfiles.length);
  allProfiles.forEach((p, i) => {
    console.log(`📊 User ${i + 1}: @${p.username} (${p.displayName}) [${p.id}] - ${p.email}`);
  });
  console.log("📊 ========================================");

  return {
    backendInstanceId: BACKEND_INSTANCE_ID,
    backendStartTime: BACKEND_START_TIME,
    processPid: process.pid,
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
