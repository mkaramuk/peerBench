# peerBench

peerBench framework implementation in TypeScript

## Quickstart

Clone the repository and install dependencies (we assume that you already installed a working [Node.js dev](https://nodejs.org/en) environment):

```shell
npm i # or "yarn install" based on your preference
```

peerBench works in three phase;

- Prompt
- Score
- Aggregate

Before you start, you need to create a `.env` file. You can use the the example one:

```sh
cp .env.example .env
```

Then fill out the variables with your values.

> You can generate a private with the following command:
>
> ```shell
> node -e "import('viem/accounts').then(({ generatePrivateKey, privateKeyToAccount }) => > { const pk = generatePrivateKey(); const acc = privateKeyToAccount(pk); console.log('Address:', acc.address); console.log('Private Key:', pk); });"
> ```

### Prompt

In prompt phase, peerBench sends the prompts/tasks/questions from the given tasks to the LLM models. Collects the responses and saves them to the local file system:

```shell
./peerbench prompt -c config.example.json
```

`-c` points to the configuration file that is going to be used for prompting process. An example is shown below:

```jsonc
{
  // Path of the task files
  "tasks": ["./data/tasks/mmlu-pro/mmlu-pro.parquet"],

  // Models that the task files will be prompted to
  // Format is: <provider name>:<model owner name>/<model name>
  // Supported providers:
  // - openrouter.ai
  "models": [
    "openrouter.ai:openai/chatgpt-4o-latest",
    "openrouter.ai:google/gemini-2.0-flash-001",
    "openrouter.ai:google/gemini-2.0-flash-lite-001",
    "openrouter.ai:meta-llama/llama-4-scout",
    "openrouter.ai:meta-llama/llama-4-maverick",
    "openrouter.ai:mistralai/mistral-small-3.1-24b-instruct"
  ]
}
```

If you want, you can also pass the maximum prompt to be executed:

```shell
./peerbench prompt -c config.example.json -m 10
```

That means only first 10 prompt from the given task files will be executed over the models and rest will be ignored.

Once the command is done, the collected responses will be available at

```
data/output/<task name>/<validator id>/<model owner>/<model name>/responses-<task name>-<timestamp>.json
```

### Score

To score your responses you need to run the following command:

```shell
./peerbench score --task <task name>
```

For `<task name>` part, you need to pass the name of the task that you've run. You can generate the scores for only one task at a time. If you've used one of the known task formats, the `task name` would be one of these:

- `mmlu-pro` (whole task)
- `mmlu-pro-<category name(s)>` (e.g `mmlu-pro-history`, `mmlu-pro-history-engineering`)
- `bigbench` (whole task)
- `bigbench-<task name>` (e.g `bigbench-social_iqa`)

Otherwise it will be set to the task file name without extension (e.g `my-task` for `my-task.json`)

### Aggregation

To see the aggregated results, you can use the aggregate command (aliased as `agg`):
 
You can also use a config file for aggregation, similar to the prompt and score commands:

```shell
./peerbench agg -c config.example.json
```

The aggregate command now provides several enhanced features:

1. **Config File Support**: Use `-c` to specify a config file with tasks and models
2. **Per-Task Analysis**: When multiple tasks are in the config, it generates individual reports for each task
3. **Combined Analysis**: Always provides a combined analysis of all tasks
4. **Automatic File Output**: Results are automatically saved to JSON files (no need to specify `-o`)
5. **Output Directory**: All files are saved to `data/output/aggregates/` directory

When using a config file with multiple tasks, the command will:
- Generate and display a results table for each individual task
- Generate and display a combined results table for all tasks
- Save separate result files for each task and the combined analysis

Output files follow this naming pattern:
```
data/output/aggregates/results-<task-name>-<timestamp>.json  # Individual task results
data/output/aggregates/results-combined-<timestamp>.json     # Combined results
```

### Data Standardization

The framework provides a data standardization tool that allows you to convert between different question schemas. Currently, it supports conversion between `mmlu-pro` and `medqa` formats.

```shell
./peerbench std --source <source-file> [--from <schema>] --to <schema> [--output <output-file>]
```

Options:
- `--source` (required): Source file with data to be standardized
- `--from` (optional): Source schema type (mmlu-pro or medqa, default: auto-detect)
- `--to` (required): Target schema type (mmlu-pro or medqa, default: medqa)
- `--output` (optional): Output file path (default: derived from source filename)

#### Example

Convert from MMLU-Pro format to MedQA format:

```shell
./peerbench std --source data/tasks/mmlu-pro/history_samples.json --to medqa
```

Convert from MedQA format to MMLU-Pro format:

```shell
./peerbench std --source data/tasks/medqa/samples.jsonl --from medqa --to mmlu-pro --output data/tasks/mmlu-pro/converted.json
```

#### Schema Examples

MMLU-Pro Format:
```json
{
  "question": "Australian and America megafauna were probably wiped out by:",
  "options": [
    "natural disasters such as volcanic eruptions or earthquakes.",
    "both humans and environmental changes.",
    "the spread of invasive plant species which altered their habitat.",
    "a sudden drastic climate change due to global warming.",
    "humans who carried diseases over the land bridge.",
    "humans.",
    "diseases transmitted by other animal species.",
    "a comet or asteroid impact.",
    "environmental changes.",
    "competition with other animal species."
  ],
  "answer": "B",
  "answer_index": 1,
  "cot_content": "",
  "category": "history",
  "src": "ori_mmlu-prehistory",
  "question_id": 4676,
  "other": {
    "hash_full_question": "4d53be6330395aeab823bdb8a02e14f7b6edfbc0f5b0dbe2233f53271c346581",
    "hash_first_sentence": "4d53be6330395aeab823bdb8a02e14f7b6edfbc0f5b0dbe2233f53271c346581",
    "hash_first_question_sentence": "4d53be6330395aeab823bdb8a02e14f7b6edfbc0f5b0dbe2233f53271c346581",
    "hash_last_sentence": "4d53be6330395aeab823bdb8a02e14f7b6edfbc0f5b0dbe2233f53271c346581",
    "preSTDsrcFileName": "mmlu-pro_test.onlyhistory-first20.jsonl",
    "preSTDsrcCID": "bafkreib4kvac3h6tn5ipllbup55asmq63ls33fse3jm2u2ftgfxssywwju"
  }
}
```

MedQA Format:
```json
{
  "question": "Australian and America megafauna were probably wiped out by:",
  "options": {
    "A": "natural disasters such as volcanic eruptions or earthquakes.",
    "B": "both humans and environmental changes.",
    "C": "the spread of invasive plant species which altered their habitat.",
    "D": "a sudden drastic climate change due to global warming.",
    "E": "humans who carried diseases over the land bridge.",
    "F": "humans.",
    "G": "diseases transmitted by other animal species.",
    "H": "a comet or asteroid impact.",
    "I": "environmental changes.",
    "J": "competition with other animal species."
  },
  "answer_idx": "B",
  "answer": "both humans and environmental changes.",
  "meta_info": "",
  "other": {
    "hash_full_question": "4d53be6330395aeab823bdb8a02e14f7b6edfbc0f5b0dbe2233f53271c346581",
    "hash_first_sentence": "4d53be6330395aeab823bdb8a02e14f7b6edfbc0f5b0dbe2233f53271c346581",
    "hash_first_question_sentence": "4d53be6330395aeab823bdb8a02e14f7b6edfbc0f5b0dbe2233f53271c346581",
    "hash_last_sentence": "4d53be6330395aeab823bdb8a02e14f7b6edfbc0f5b0dbe2233f53271c346581",
    "mmlu-pro__question_id": 4676,
    "mmlu-pro__answer_index": 1,
    "mmlu-pro__cot_content": "",
    "mmlu-pro__category": "history",
    "mmlu-pro__src": "ori_mmlu-prehistory",
    "preSTDsrcFileName": "mmlu-pro_test.onlyhistory-first20.jsonl",
    "preSTDsrcCID": "bafkreib4kvac3h6tn5ipllbup55asmq63ls33fse3jm2u2ftgfxssywwju"
  }
}
```

The standardization feature also handles:
- Both JSON and JSONL file formats
- Automatic schema detection
- Generation of content hashes for question matching
- Assignment of UUIDs for tracking
- Preservation of source information
