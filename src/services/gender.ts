/**
 * Gender API services
 */

import { apiPost } from "./api";

export type { CreateGenderPayload } from "@/lib/schemas/gender";

export type { Gender } from "@/models/admin";
import type { Gender } from "@/models/admin";

export async function createGender(name: string): Promise<Gender> {
  return apiPost<Gender>("/api/genders", { name });
}
