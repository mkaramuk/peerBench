"use server";

import { FileService, GetFilesOptions } from "@/services/file.service";

export async function getFiles(options: GetFilesOptions) {
  return await FileService.getFiles(options);
}
