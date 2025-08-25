import { AbstractUploader, UploadOptions } from "@/base/uploader";
import { checkValidationError, readFile } from "@/core/utils";
import { PromptScoreSchema } from "@/types";
import axios, { AxiosError } from "axios";
import { z } from "zod";

/**
 * Uploader class to upload files to the coordination server
 */
export class CoServerUploader extends AbstractUploader {
  override name = "CoServer";
  token: string = "";
  client = axios.create({
    baseURL: "https://deval-flask.onrender.com",
  });

  async init() {
    // We already have the token, no need to fetch it again.
    if (this.token !== "") return;

    this.logger.info(`Generating a new token`);
    const response = await this.client.post(`/token`, {
      user: "validator",
      role: "validator",
    });

    this.token = response.data?.token;
    this.client = axios.create({
      baseURL: "https://deval-flask.onrender.com",
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async uploadPromptResponses(filePath: string, options?: UploadOptions) {
    throw new Error("CoServer doesn't support uploading responses");
    // TODO: Paused since the CoServer doesn't support submitting responses

    // const fileContent = readFile(filePath);
    // const arraySchema = z.array(PromptResponseSchema);
    // const parseResult = arraySchema.safeParse(JSON.parse(fileContent));
    // const responses = checkValidationError(parseResult);

    // TODO: paused since the CoServer doesn't support batch requests
    // const upload = async (skip: number, take: number) => {
    //   const partition: PromptResponse[] = [];
    //   for (let i = skip; i < responses.length; i++) {
    //     // We've taken all the items that we want, no need to continue;
    //     if (i > take) break;
    //     partition.push(responses[i]);
    //   }
    //   const res = await this.client.post("/submit-score", partition);
    // };
    // let num = 1;
    // for (const response of responses) {
    //   try {
    //     const res = await this.client.post("/submit-score", response);
    //     const data = res.data;
    //     if (data?.status === "success") {
    //       this.logger.info(
    //         `Response ${num} uploaded to the CoServer successfully`
    //       );
    //     } else {
    //       throw new Error(JSON.stringify(data || {}));
    //     }
    //   } catch (err: any) {
    //     this.logger.debug(
    //       `Error while uploading the responses: ${
    //         err?.stack || err?.message || err
    //       }`
    //     );
    //     this.logger.error(`Error while uploading response ${num}: ${err}`);
    //   }
    //   num++;
    // }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async uploadScores(filePath: string, options?: UploadOptions) {
    const fileContent = readFile(filePath);
    const arraySchema = z.array(PromptScoreSchema);
    const parseResult = arraySchema.safeParse(JSON.parse(fileContent));
    const scores = checkValidationError(parseResult);

    let num = 1;
    for (const score of scores) {
      try {
        const res = await this.client.post("/submit-score", {
          ...score,
          // TODO: On the CoServer side, change `evaluationRunId` to `runId`
          evaluationRunId: score.runId,
        });
        const data = res.data;

        if (data?.status === "success") {
          this.logger.info(
            `Score ${num} uploaded to the CoServer successfully`
          );
        } else {
          throw new Error(JSON.stringify(data || {}));
        }
      } catch (err: any) {
        let message: any = err;
        if (err instanceof AxiosError) {
          message = err.response?.data || err;
        }
        this.logger.error(
          `Error while uploading score ${num}: ${JSON.stringify(message)}`
        );
      }
      num++;
    }
  }
}
