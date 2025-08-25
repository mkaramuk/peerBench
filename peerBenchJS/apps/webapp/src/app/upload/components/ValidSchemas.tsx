import React from "react";

interface SchemaExample {
  title: React.ReactNode;
  example: string;
}

const schemaExamples: Record<string, SchemaExample> = {
  medqa: {
    title: (
      <a
        className="text-blue-500 dark:text-blue-300 underline"
        href="https://paperswithcode.com/dataset/medqa-usmle"
        target="_blank"
      >
        MedQA
      </a>
    ),
    example: `[
  {
    "question": "What is the most common cause of acute viral hepatitis worldwide?",
    "options": {
      "A": "Hepatitis A virus",
      "B": "Hepatitis B virus",
      "C": "Hepatitis C virus",
      "D": "Hepatitis E virus"
    },
    "answer": "Hepatitis A virus",
    "answer_idx": "A",
    "meta_info": "Gastroenterology"
  }
  ...
]`,
  },
  "mmlu-pro": {
    title: (
      <a
        className="text-blue-500 dark:text-blue-300 underline"
        href="https://huggingface.co/datasets/TIGER-Lab/MMLU-Pro"
        target="_blank"
      >
        MMLU-Pro
      </a>
    ),
    example: `[
  {
    "question_id": 12345,
    "question": "A 45-year-old patient presents with...",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "answer": "Option A",
    "answer_index": 0,
    "cot_content": "Let's analyze this step by step...",
    "category": "Clinical Medicine",
    "src": "USMLE Step 2 CK"
  }
  ...
]`,
  },
  oldpb: {
    title: "PeerBench Old Task Schema",
    example: `[
  {
    "question": "Which of the following is true about...",
    "options": {
      "A": "Option A",
      "B": "Option B",
      "C": "Option C",
      "D": "Option D"
    },
    "answer_idx": "A",
    "answer": "Option A",
    "meta_info": "Basic Science",
    "other": {
      "hash_full_question": "abc123...",
      "hash_first_sentence": "def456...",
      "hash_first_question_sentence": "ghi789...",
      "hash_last_sentence": "jkl012...",
      "stdQuestionUUID": "uuid-123...",
      "stdFullPromptText": "Full question text...",
      "stdFullPromptHash": "mno345...",
      "src_row_number": 1,
      "preSTDsrcFileName": "source.json",
      "preSTDsrcCID": "cid-123..."
    }
  }
  ...
]`,
  },
};

export default function ValidSchemas() {
  return (
    <div className="mb-4 space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Your file should follow one of these formats:
      </p>
      <div className="space-y-4">
        {Object.entries(schemaExamples).map(
          ([key, schema]: [string, SchemaExample]) => (
            <details key={key} className="group">
              <summary className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600">
                <div>
                  <h3 className="font-medium">{schema.title}</h3>
                </div>
                <svg
                  className="w-5 h-5 transform group-open:rotate-180 transition-transform"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </summary>
              <div className="mt-2 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <pre className="text-sm overflow-x-auto p-4 bg-gray-100 dark:bg-gray-800 rounded">
                  <code>{schema.example}</code>
                </pre>
              </div>
            </details>
          )
        )}
      </div>
    </div>
  );
}
