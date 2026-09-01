import { type AddRequest, type AddResult, type CommitOverrides, type Prepared, commit, prepare } from "../lib/pipeline/addWord";

// An editor job lives in chrome.storage.session under job:<id>; the editor window watches it.
export interface Job {
  id: string;
  status: "generating" | "ready" | "committing" | "done" | "error";
  request: AddRequest;
  prepared?: Prepared;
  result?: AddResult;
  error?: string;
}

const key = (id: string) => `job:${id}`;

async function save(job: Job): Promise<void> {
  await chrome.storage.session.set({ [key(job.id)]: job });
}

export async function getJob(id: string): Promise<Job | undefined> {
  const stored = await chrome.storage.session.get(key(id));
  return stored[key(id)] as Job | undefined;
}

async function generate(job: Job): Promise<void> {
  const prepared = await prepare(job.request);
  if ("status" in prepared) {
    await save({ ...job, status: "error", result: prepared, error: prepared.status === "error" ? prepared.message : "duplicate" });
  } else {
    await save({ ...job, status: "ready", prepared });
  }
}

export async function createJob(request: AddRequest): Promise<Job> {
  const job: Job = { id: crypto.randomUUID(), status: "generating", request };
  await save(job);
  void generate(job);
  return job;
}

export async function regenerateJob(id: string, hint: string): Promise<void> {
  const job = await getJob(id);
  if (!job) throw new Error("Job not found");
  const next: Job = { ...job, status: "generating", request: { ...job.request, hint }, prepared: undefined, result: undefined, error: undefined };
  await save(next);
  void generate(next);
}

export async function commitJob(id: string, overrides: CommitOverrides): Promise<AddResult> {
  const job = await getJob(id);
  if (!job?.prepared) throw new Error("Nothing to add yet");
  await save({ ...job, status: "committing" });
  const result = await commit(job.prepared, overrides);
  await save({ ...job, status: result.status === "error" ? "ready" : "done", result });
  return result;
}

export async function openEditor(request: AddRequest): Promise<Job> {
  const job = await createJob(request);
  await chrome.windows.create({ url: chrome.runtime.getURL(`editor/index.html?job=${job.id}`), type: "popup", width: 600, height: 760 });
  return job;
}
