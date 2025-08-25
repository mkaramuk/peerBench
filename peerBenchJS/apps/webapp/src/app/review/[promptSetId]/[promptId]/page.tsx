"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { useQuiz } from "./hooks/useQuiz";
import { QuizOptions } from "./components/QuizOptions";
import { QuizProgress } from "./components/QuizProgress";
import { FeedbackForm } from "./components/FeedbackForm";

export default function QuizPage() {
  const {
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
  } = useQuiz();

  return (
    <main className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <LoadingOverlay isLoading={loading} message="Loading question..." />
      <div className="max-w-3xl mx-auto">
        <AnimatePresence mode="wait">
          {prompt ? (
            <motion.div
              key="quiz"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white dark:bg-gray-950 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-800"
            >
              <div className="space-y-8">
                <QuizProgress
                  currentIndex={currentIndex}
                  totalQuestions={promptIds.length}
                  progress={progress}
                />

                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                    {prompt.question}
                  </h2>
                  <QuizOptions
                    prompt={prompt}
                    selectedAnswer={selectedAnswer}
                    showFeedback={showFeedback}
                    onAnswerSelect={handleAnswerSelect}
                  />
                </div>

                <div className="flex justify-between items-center">
                  <Button
                    onClick={handleSubmit}
                    disabled={!selectedAnswer || showFeedback || isSubmitting}
                    variant="default"
                    size="default"
                  >
                    {isSubmitting ? "Saving..." : "Submit Answer"}
                  </Button>

                  {showFeedback && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center space-x-2"
                    >
                      {isCorrect ? (
                        <>
                          <CheckCircleIcon className="h-6 w-6 text-green-500" />
                          <span className="text-green-500 font-medium">
                            Correct!
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircleIcon className="h-6 w-6 text-red-500" />
                          <span className="text-red-500 font-medium">
                            Incorrect
                          </span>
                        </>
                      )}
                      <Button
                        onClick={handleNext}
                        disabled={isSubmitting}
                        variant="default"
                        size="default"
                      >
                        {isSubmitting
                          ? "Saving..."
                          : currentIndex < promptIds.length - 1
                            ? "Next Question"
                            : "Complete Quiz"}
                      </Button>
                    </motion.div>
                  )}
                </div>

                {showFeedback && user && (
                  <FeedbackForm promptId={prompt.id} userId={user.id} />
                )}
              </div>
            </motion.div>
          ) : (
            !loading && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center text-red-500 dark:text-red-400"
              >
                Question not found
              </motion.div>
            )
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
