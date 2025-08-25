import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { PromptSetService } from "@/services/prompt.service";
import { DataContent } from "./components/DataContent";

export const fetchCache = "force-no-store";

export default async function DataPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const promptSets = await PromptSetService.getPromptSets({
    ownerId: user.id,
  });

  // Fetch feedback for each prompt set
  const feedbacks = await PromptSetService.getPromptSetFeedback(
    promptSets.map((set) => set.id)
  );

  const analytics = await PromptSetService.getAnalytics();

  return (
    <DataContent
      promptSets={promptSets}
      feedbacks={feedbacks}
      analytics={analytics}
    />
  );
}
