import { promises as fs } from "fs";
import path from "path";

export type UserProfileRecord = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  shareCookbookWithFriends: boolean;
  createdAt: string;
  updatedAt: string;
};

const DATA_FILE = path.join(process.cwd(), "backend", "data", "users.json");

async function ensureDataFile() {
  try {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify([]), "utf-8");
  }
}

export async function loadAllUserProfiles(): Promise<UserProfileRecord[]> {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data;
    return [];
  } catch {
    return [];
  }
}

export async function saveAllUserProfiles(users: UserProfileRecord[]): Promise<void> {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(users, null, 2), "utf-8");
}

export async function upsertUserProfile(record: UserProfileRecord): Promise<UserProfileRecord> {
  const all = await loadAllUserProfiles();
  const idx = all.findIndex((u) => u.id === record.id);

  if (idx >= 0) {
    all[idx] = record;
  } else {
    all.push(record);
  }

  await saveAllUserProfiles(all);
  return record;
}

export async function findUserById(id: string): Promise<UserProfileRecord | null> {
  const all = await loadAllUserProfiles();
  return all.find((u) => u.id === id) ?? null;
}

export async function searchUsersByUsername(query: string, excludeUserId?: string): Promise<UserProfileRecord[]> {
  const all = await loadAllUserProfiles();
  const normalized = query.trim().toLowerCase();

  return all
    .filter((u) => u.id !== excludeUserId)
    .filter((u) => u.username.toLowerCase().includes(normalized));
}
