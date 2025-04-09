import val as v

# Initialize the evaluator
val = v.val(
    task='add',          # Task to evaluate (e.g., 'add', 'divide')
    provider='openrouter', # Model provider
    n=4,                 # Number of models to test
    samples_per_epoch=2  # Samples per evaluation epoch
)

# Run an evaluation epoch
results = val.epoch()
print(results)
a = 1+1