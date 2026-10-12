// New facts are mirrored into the Google Drive master backup in real time.
// See backup.server.ts.
import { appendFactToBackup } from "./backup.server";

export async function appendFactToSheet(fact: {
  code: string;
  code_seq: number;
  category: string | null;
  question: string;
  answer: string;
  fun_fact: string | null;
  created_at?: string | null;
  id?: string;
  source?: string;
}): Promise<void> {
  await appendFactToBackup({ source: "ai", ...fact });
}
