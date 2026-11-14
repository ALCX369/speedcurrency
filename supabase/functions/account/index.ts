// Deletes the signed-in user's account: their private files, then the account itself.
// Database rows are removed by ON DELETE CASCADE; payment records are kept (user_id set to null) for tax law.
import { admin, cors, currentUser, json } from "../_shared/common.ts";

async function removeFolder(db: ReturnType<typeof admin>, bucket: string, folder: string) {
  for (let i = 0; i < 20; i++) {
    const { data } = await db.storage.from(bucket).list(folder, { limit: 100 });
    if (!data?.length) return;
    await db.storage.from(bucket).remove(data.map((f) => `${folder}/${f.name}`));
    if (data.length < 100) return;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const user = await currentUser(req);
  if (!user) return json({ error: "Sign in first" }, 401);
  const body = await req.json().catch(() => ({}));
  if (body.action !== "delete" || body.confirm !== "DELETE") return json({ error: "Type DELETE to confirm" }, 400);

  const db = admin();
  await removeFolder(db, "journal", user.id);
  await removeFolder(db, "proofs", user.id);
  await db.from("payments").update({ proof_path: null }).eq("user_id", user.id);
  const { error } = await db.auth.admin.deleteUser(user.id);
  if (error) return json({ error: error.message }, 400);
  return json({ ok: true });
});
