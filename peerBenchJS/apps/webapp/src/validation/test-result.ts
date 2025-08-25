import { z } from "zod";

export const TestResultSchema = z.object({
  isSuccess: z.boolean(),
  raw: z.string(),
  result: z.record(z.any()),
  testName: z.string(),
});

export type TestResult = z.infer<typeof TestResultSchema>;
