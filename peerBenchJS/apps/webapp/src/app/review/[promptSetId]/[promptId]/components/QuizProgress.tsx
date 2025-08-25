import { motion } from "framer-motion";

interface QuizProgressProps {
  currentIndex: number;
  totalQuestions: number;
  progress: number;
}

export function QuizProgress({
  currentIndex,
  totalQuestions,
  progress,
}: QuizProgressProps) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
        <span>
          Question {currentIndex + 1} of {totalQuestions}
        </span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <motion.div
          className="bg-primary-500 h-2.5 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </div>
  );
}
