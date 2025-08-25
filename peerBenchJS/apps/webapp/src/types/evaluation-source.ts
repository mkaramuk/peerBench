export const EvaluationSource = {
  PeerBench: "peerBench",
  ForestAI: "forestai",
} as const;

export type EvaluationSourceType =
  (typeof EvaluationSource)[keyof typeof EvaluationSource];
