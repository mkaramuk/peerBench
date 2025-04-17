# peerBench

peerBench framework implementation in TypeScript

## Quickstart

Clone the repository and install dependencies (we assume that you already installed a working Node.js dev environment):

```shell
npm i # or "yarn install" based on your preference
```

peerBench works in three phase;

- Prompt
- Score
- Aggregate

### Prompt

In prompt phase, peerBench sends the prompts/tasks/questions from the given tasks to the LLM models. Collects the responses and saves them to the local file system:

```shell
./peerbench prompt -c config.example.json --runname bigbench
```

`-c` points to the configuration file that is going to be used for prompting process. An example is shown below:

```jsonc
{
  // Path of the task files
  "tasks": ["./data/tasks/mmlu-pro/mmlu-pro.onlyHistory.jsonl"],

  // Models that the tasks files will be prompted to
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

`--runname` indicates the custom name (default value is "run") for this prompt run process. Based on the `--runname`, a sub directory will be created under `data/output` and all the responses will be saved there.
