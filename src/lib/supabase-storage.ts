import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key);
}

const BUCKET = "statements";

export async function uploadStatementFile(
  userId: string,
  fileName: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const supabase = getAdminClient();
  const path = `${userId}/${Date.now()}_${fileName}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: mimeType, upsert: false });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return path;
}

export async function getStatementFileBuffer(storagePath: string): Promise<Buffer> {
  const supabase = getAdminClient();
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error || !data) throw new Error(`Storage download failed: ${error?.message}`);
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function deleteStatementFile(storagePath: string): Promise<void> {
  const supabase = getAdminClient();
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) throw new Error(`Storage delete failed: ${error.message}`);
}
