export const FileType = {
  Prompt: "prompt",
  Score: "score",
  Evaluation: "evaluation",
  Audit: "audit",
} as const;

export type FileTypeType = (typeof FileType)[keyof typeof FileType];
