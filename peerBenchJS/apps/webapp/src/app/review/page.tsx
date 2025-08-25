import { PromptSetService } from "@/services/prompt.service";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { ReviewEntry } from "./ReviewEntry";

export const fetchCache = "force-no-store";

export default async function ReviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const promptSets = await PromptSetService.getPromptSets();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Review Questions</h1>
      <ReviewEntry items={promptSets} />
    </div>
  );
}
