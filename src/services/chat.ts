/**
 * Chat API services
 */

import { apiPost } from "./api";

export type { ChatApiMessage, ChatRequest, ChatResponse } from "@/models/chat";
import type { ChatRequest, ChatResponse } from "@/models/chat";

export async function sendChatMessage(payload: ChatRequest): Promise<ChatResponse> {
  return apiPost<ChatResponse>("/api/chat/campaign", payload);
}
