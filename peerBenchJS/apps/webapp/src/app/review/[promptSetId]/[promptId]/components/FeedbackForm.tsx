import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import Select from "react-select";
import { toast } from "react-toastify";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { FeedbackFlag } from "@/types/feedback";
import { saveFeedback } from "@/actions/saveFeedback";

interface FeedbackFormProps {
  promptId: string;
  userId: string;
  onSubmit?: () => void;
}

interface FeedbackFormData {
  flag: FeedbackFlag;
  feedback: string;
}

interface SelectOption {
  value: FeedbackFlag;
  label: string;
}

const feedbackSchema = yup
  .object({
    flag: yup
      .string()
      .oneOf(["incorrect", "unclear", "typo", "other"] as const)
      .required("Please select an issue type"),
    feedback: yup
      .string()
      .required("Please provide feedback")
      .min(10, "Feedback must be at least 10 characters"),
  })
  .required();

const selectOptions: SelectOption[] = [
  { value: "incorrect", label: "Incorrect Answer" },
  { value: "unclear", label: "Unclear Question" },
  { value: "typo", label: "Typo or Error" },
  { value: "other", label: "Other Issue" },
];

export function FeedbackForm({
  promptId,
  userId,
  onSubmit,
}: FeedbackFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FeedbackFormData>({
    resolver: yupResolver(feedbackSchema),
    defaultValues: {
      flag: "incorrect",
      feedback: "",
    },
  });

  const onSubmitForm = async (data: FeedbackFormData) => {
    try {
      setIsSubmitting(true);
      await saveFeedback({
        promptId,
        userId,
        ...data,
      });

      toast.success("Thank you for your feedback!");
      reset();
      setIsOpen(false);
      onSubmit?.();
    } catch (error) {
      toast.error("Failed to submit feedback. Please try again.");
      console.error("Error submitting feedback:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <Button onClick={() => setIsOpen(true)} variant="default" size="default">
        Report an Issue
      </Button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-4 p-4 border rounded-lg bg-gray-50"
    >
      <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Issue Type
          </label>
          <Controller
            name="flag"
            control={control}
            render={({ field }) => (
              <Select<SelectOption>
                {...field}
                options={selectOptions}
                className="react-select"
                classNamePrefix="react-select"
                isSearchable={false}
                value={selectOptions.find(
                  (option) => option.value === field.value
                )}
                onChange={(option) => field.onChange(option?.value)}
              />
            )}
          />
          {errors.flag && (
            <p className="mt-1 text-sm text-red-600">{errors.flag.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Feedback
          </label>
          <Textarea
            {...register("feedback")}
            placeholder="Please describe the issue..."
            className="min-h-[100px]"
          />
          {errors.feedback && (
            <p className="mt-1 text-sm text-red-600">
              {errors.feedback.message}
            </p>
          )}
        </div>

        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            onClick={() => {
              reset();
              setIsOpen(false);
            }}
            disabled={isSubmitting}
            variant="outline"
            size="default"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            variant="default"
            size="default"
          >
            {isSubmitting ? "Submitting..." : "Submit Feedback"}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}
