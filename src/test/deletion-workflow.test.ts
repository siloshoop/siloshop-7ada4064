// @vitest-environment node
import { it, expect, vi } from "vitest";
import { runDeletion, type DeletionSteps } from "../../supabase/functions/_shared/deletionWorkflow";
const steps = (stage = "prepared", count = 1): DeletionSteps => ({
  prepare: vi.fn(async () => ({ stage, assets: Array.from({ length: count }, (_, i) => ({ bucket: "product-images", path: `isolated/${i}.jpg` })) })),
  removeAssets: vi.fn(async () => {}), finishDatabase: vi.fn(async () => {}),
  deleteAuth: vi.fn(async () => {}), complete: vi.fn(async () => {}),
});
it("account deletion finishes media and database before permanently deleting Auth", async () => {
  const calls: string[] = []; const s = steps();
  s.removeAssets = async () => { calls.push("media"); };
  s.finishDatabase = async () => { calls.push("database"); };
  s.deleteAuth = async () => { calls.push("auth"); };
  s.complete = async () => { calls.push("complete"); };
  await runDeletion("account", s);
  expect(calls).toEqual(["media", "database", "auth", "complete"]);
});
it("store deletion never deletes buyer login", async () => {
  const s = steps(); await runDeletion("store", s);
  expect(s.deleteAuth).not.toHaveBeenCalled(); expect(s.finishDatabase).toHaveBeenCalledTimes(1);
});
it("media failure stops database and login deletion", async () => {
  const s = steps(); s.removeAssets = vi.fn(async () => { throw new Error("storage_cleanup_failed"); });
  await expect(runDeletion("account", s)).rejects.toThrow("storage_cleanup_failed");
  expect(s.finishDatabase).not.toHaveBeenCalled(); expect(s.deleteAuth).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled();
});
it("database failure never deletes login or reports completion", async () => {
  const s = steps(); s.finishDatabase = vi.fn(async () => { throw new Error("database_cleanup_failed"); });
  await expect(runDeletion("account", s)).rejects.toThrow("database_cleanup_failed");
  expect(s.deleteAuth).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled();
});
it("database_done retry resumes Auth deletion without repeating successful cleanup", async () => {
  const s = steps("database_done"); await runDeletion("account", s);
  expect(s.removeAssets).not.toHaveBeenCalled(); expect(s.finishDatabase).not.toHaveBeenCalled(); expect(s.deleteAuth).toHaveBeenCalledTimes(1);
});
it("all media is removed in bounded batches without truncating large stores", async () => {
  const s = steps("prepared", 251); await runDeletion("store", s);
  expect(vi.mocked(s.removeAssets).mock.calls.map(([, paths]) => paths.length)).toEqual([100, 100, 51]);
});