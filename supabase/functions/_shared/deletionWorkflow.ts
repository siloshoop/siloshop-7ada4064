export type DeletionScope = "store" | "account";
export type DeletionAsset = { bucket: string; path: string };
export type DeletionJob = { stage: string; assets: DeletionAsset[] };
export interface DeletionSteps {
  prepare: () => Promise<DeletionJob>;
  removeAssets: (bucket: string, paths: string[]) => Promise<void>;
  finishDatabase: () => Promise<void>;
  deleteAuth: () => Promise<void>;
  complete: () => Promise<void>;
}

// Storage is not transactional with PostgreSQL. A durable inventory makes every
// stage retryable; never delete the login before all eligible cleanup succeeds.
export async function runDeletion(scope: DeletionScope, steps: DeletionSteps) {
  const job = await steps.prepare();
  if (job.stage === "complete") return;
  if (job.stage === "prepared") {
    const buckets = new Map<string, string[]>();
    for (const asset of job.assets) {
      const paths = buckets.get(asset.bucket) ?? [];
      paths.push(asset.path);
      buckets.set(asset.bucket, paths);
    }
    for (const [bucket, paths] of buckets) {
      for (let i = 0; i < paths.length; i += 100) {
        await steps.removeAssets(bucket, paths.slice(i, i + 100));
      }
    }
    await steps.finishDatabase();
  }
  if (scope === "account") await steps.deleteAuth();
  await steps.complete();
}