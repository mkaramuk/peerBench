"use server";

import { PromptSetService } from "@/services/prompt.service";

export async function getPeerAggregations(promptSetId: number) {
  try {
    const aggregations =
      await PromptSetService.getPeerAggregations(promptSetId);
    return { success: true, data: aggregations };
  } catch (error) {
    console.error("Error fetching peer aggregations:", error);
    return { success: false, error: "Failed to fetch peer aggregations" };
  }
}

export async function getPromptSets() {
  try {
    const promptSets = await PromptSetService.getPromptSets();
    return { success: true, data: promptSets };
  } catch (error) {
    console.error("Error fetching prompt sets:", error);
    return { success: false, error: "Failed to fetch prompt sets" };
  }
}

export async function getPromptSetForBenchmark(promptSetId: number) {
  try {
    const promptSet =
      await PromptSetService.getPromptSetForBenchmark(promptSetId);
    return { success: true, data: promptSet };
  } catch (error) {
    console.error("Error fetching prompt set for benchmark:", error);
    return {
      success: false,
      error: "Failed to fetch prompt set for benchmark",
    };
  }
}
