"use server";

import { PromptSetService } from "@/services/prompt.service";
import { FeedbackFlag } from "@/types/feedback";

export async function saveFeedback(data: {
  promptId: string;
  feedback: string;
  flag: FeedbackFlag;
  userId: string;
}) {
  return await PromptSetService.savePromptFeedback(data);
}
