import { db } from "@/database/client";

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
