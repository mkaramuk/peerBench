import { motion } from "framer-motion";
import { DbPrompt } from "@/database/schema";

interface QuizOptionsProps {
  prompt: DbPrompt;
  selectedAnswer: string | null;
  showFeedback: boolean;
  onAnswerSelect: (key: string) => void;
}

export function QuizOptions({
  prompt,
  selectedAnswer,
  showFeedback,
  onAnswerSelect,
}: QuizOptionsProps) {
  const getOptionColor = (key: string) => {
    if (!showFeedback) {
      return selectedAnswer === key
        ? "bg-blue-100 dark:bg-blue-900/50 border-blue-500 dark:border-blue-400"
        : "hover:bg-gray-50 dark:hover:bg-gray-800 border-gray-200 dark:border-gray-700";
    }

    if (key === prompt?.answerKey) {
      return "bg-green-100 dark:bg-green-900/50 border-green-500 dark:border-green-400";
    }

    if (key === selectedAnswer && key !== prompt?.answerKey) {
      return "bg-red-100 dark:bg-red-900/50 border-red-500 dark:border-red-400";
    }

    return "border-gray-200 dark:border-gray-700";
  };

  return (
    <div className="space-y-4">
      {Object.entries(prompt.options).map(([key, value]) => (
        <motion.button
          key={key}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onAnswerSelect(key)}
          className={`hover:cursor-pointer w-full p-4 rounded-lg border-2 transition-all duration-200 ${getOptionColor(
            key
          )}`}
          disabled={showFeedback}
        >
          <div className="flex items-center">
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {key.toUpperCase()}. {value}
            </span>
          </div>
        </motion.button>
      ))}
    </div>
  );
}
