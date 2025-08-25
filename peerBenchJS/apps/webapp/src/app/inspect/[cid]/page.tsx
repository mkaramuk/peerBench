import { FileService } from "@/services/file.service";
import Evaluations from "./components/Evaluations";
import Header from "./components/Header";
import { FileType } from "@/types/file-type";
import { EvaluationService } from "@/services/evaluation.service";

export default async function Page(props: {
  params: Promise<{ cid: string }>;
}) {
  const cid = (await props.params).cid;

  try {
    const result = await FileService.getFile(cid);

    if (result.type !== FileType.Evaluation && result.type !== FileType.Audit) {
      // Prepare download link if content exists
      let downloadUrl = null;
      const fileName = result.name || `raw-file-${Date.now()}`;
      if (result.content) {
        // Encode content as base64 for data URL
        const base64Content = Buffer.from(result.content, "utf-8").toString(
          "base64"
        );
        downloadUrl = `data:text/plain;base64,${base64Content}`;
      }
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-gray-500 bg-gray-50 dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-2">Not Supported</h2>
            <p>
              This file type doesn&apos;t support to be shown on the UI. You can
              download it{" "}
              {downloadUrl ? (
                <a
                  href={downloadUrl}
                  download={fileName}
                  className="text-blue-600 underline hover:text-blue-800"
                >
                  here
                </a>
              ) : (
                "here"
              )}
            </p>
          </div>
        </div>
      );
    }

    if (!result) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-gray-500 bg-gray-50 dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-2">Not Found</h2>
            <p>Raw file not found</p>
          </div>
        </div>
      );
    }

    const evaluations = await EvaluationService.getEvaluations({ cid });

    return (
      <main className="min-h-screen">
        <div className="container mx-auto space-y-4 px-4 py-8 max-w-7xl">
          <Header evaluationCount={evaluations.length} />
          <Evaluations evaluations={evaluations} />
        </div>
      </main>
    );
  } catch (error) {
    console.error("error", error);
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500 bg-red-50 dark:bg-red-900/20 p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p>{JSON.stringify(error)}</p>
        </div>
      </div>
    );
  }
}
