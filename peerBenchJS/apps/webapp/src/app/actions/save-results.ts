"use server";

import {
  EvaluationService,
  SavePeerBenchResultsParams,
} from "@/services/evaluation.service";
import { getUser } from "@/utils/auth";

export async function savePeerBenchResults(
  params: Omit<SavePeerBenchResultsParams, "uploaderId">
) {
  const user = await getUser();
  return await EvaluationService.savePeerBenchScores({
    ...params,
    uploaderId: user.id,
  });
}
