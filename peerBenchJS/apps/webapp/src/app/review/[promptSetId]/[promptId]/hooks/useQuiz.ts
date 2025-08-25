import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { DbPrompt } from "@/database/schema";
import { getPrompt } from "@/actions/getPrompt";
import { getPromptIds } from "@/actions/getPromptIds";
import { saveAnswer } from "@/actions/saveAnswer";
import { toast } from "react-toastify";
import { User } from "@supabase/supabase-js";
import { getUser } from "@/app/actions/auth";

export function useQuiz() {
  const { promptId, promptSetId } = useParams();
  const router = useRouter();
  const [promptIds, setPromptIds] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [prompt, setPrompt] = useState<DbPrompt | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      let ids = promptIds;
      if (promptIds.length === 0) {
        ids = await getPromptIds(parseInt(promptSetId!.toString()));
        setPromptIds(ids);
      }

      const currentIdx = ids.findIndex((id) => id === promptId);
      setCurrentIndex(currentIdx);
      setPrompt(await getPrompt(promptId as string));
      setLoading(false);
    };
    fetchData();
  }, [promptId, promptSetId, promptIds]);

  useEffect(() => {
    const fetchUser = async () => setUser(await getUser());
    fetchUser();
  }, []);

  const handleAnswerSelect = (answerKey: string) => {
    if (showFeedback) return;
    setSelectedAnswer(answerKey);
  };

  const handleSubmit = async () => {
    if (!selectedAnswer || !prompt || !user) return;

    try {
      setIsSubmitting(true);
      const correct = selectedAnswer === prompt.answerKey;
      setIsCorrect(correct);
      setShowFeedback(true);

      await saveAnswer(user.id, promptId as string, selectedAnswer);
    } catch (error) {
      toast.error("Failed to save your answer. Please try again.");
      console.error("Error saving answer:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < promptIds.length - 1) {
      const nextPromptId = promptIds[currentIndex + 1];
      router.push(`/review/${promptSetId}/${nextPromptId}`);
      setSelectedAnswer(null);
      setShowFeedback(false);
      setIsCorrect(false);
    } else {
      router.push(`/dashboard`);
    }
  };

  const progress = ((currentIndex + 1) / promptIds.length) * 100;

  return {
    prompt,
    loading,
    selectedAnswer,
    showFeedback,
    isCorrect,
    isSubmitting,
    progress,
    currentIndex,
    promptIds,
    user,
    handleAnswerSelect,
    handleSubmit,
    handleNext,
  };
}
