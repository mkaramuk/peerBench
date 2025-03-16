import os
import asyncio
import csv
import pandas as pd
import polars as pl
from litellm import completion
from datetime import datetime
from compute_ipfs_cid import compute_ipfs_cids  # Add this import at the top
 
os.environ["validator_privatekey_hot"] = "67499ec186126dcdb98f2af7f396d1b410cc979959b56fb3bc6ca5d294e76bb2" #cafe 
os.environ["OPENAI_API_KEY"] = "your-api-key"  #later add pulling these configs from a secrets file 
os.environ["OPENROUTER_API_KEY"] = "openrouter_api_key"
os.environ["XAI_API_KEY"] = "your-api-key"
os.environ["ANTHROPIC_API_KEY"] = "your-api-key"

to_be_evaluated = [ "openai/gpt-4o","anthropic/claude-3-sonnet-20240229","xai/grok-2-latest","openrouter/google/palm-2-chat-bison"]   #later add pulling the list of to be evaluated model from a config file 

test_data = [ "what are the differences between ed25519 and secp256k1 when should I use one over the other", "can I derive a secp256k1 private key from a ed25519 private key and in the reverse" , "what is a self hosted fully opensource laternative to openrouter"]  #later add pulling this from a csv  and   add pulling this from a server 

async def get_model_completion(model_name, test_question):
    try:
        start_time = datetime.now().isoformat()
        response = await completion(
            model=model_name,
            messages=[{"content": test_question, "role": "user"}]
        )
        end_time = datetime.now().isoformat()
        return {
            "model": model_name,
            "response": response,
            "error": None,
            "request_timestamp": start_time,
            "response_timestamp": end_time
        }
    except Exception as e:
        end_time = datetime.now().isoformat()
        return {
            "model": model_name,
            "error": str(e),
            "response": None,
            "request_timestamp": start_time,
            "response_timestamp": end_time
        }

async def evaluate_models():
    all_results = []
    for test_question in test_data:
        tasks = [get_model_completion(model, test_question) for model in to_be_evaluated]
        question_results = await asyncio.gather(*tasks)
        
        # Flatten results for this question
        for model_result in question_results:
            all_results.append({
                "question": test_question,
                "model": model_result['model'],
                "response": model_result['response'],
                "error": model_result['error'],
                "request_timestamp": model_result['request_timestamp'],
                "response_timestamp": model_result['response_timestamp']
            })
    return all_results

def save_results_to_csv(results, filename='evaluation_results.csv'):
    filepath = os.path.join(os.path.dirname(__file__), filename)
    fieldnames = ['question', 'model', 'response', 'error', 'request_timestamp', 'response_timestamp']
    
    with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)
    return filepath

def save_results_to_parquet(results, filename='evaluation_results.parquet'):
    filepath = os.path.join(os.path.dirname(__file__), filename)
    # Convert results list to polars DataFrame and save
    df = pl.DataFrame(results)
    df.write_parquet(filepath)
    return filepath

if __name__ == "__main__":
    print("hello4.\n")
    results = asyncio.run(evaluate_models())
    current_question = None
    for result in results:
        if current_question != result['question']:
            current_question = result['question']
            print(f"\nQuestion: {current_question}")
            print("-" * 50)
        print(f"\nModel: {result['model']}")
        print(result['response'])
        if result['model'] == to_be_evaluated[-1]:  # If it's the last model
            print("\n" + "=" * 80)
    
    # Save results to CSV and Parquet
    csv_path = save_results_to_csv(results)
    parquet_path = save_results_to_parquet(results)
    print(f"\nResults saved to CSV: {csv_path}")
    print(f"Results saved to Parquet: {parquet_path}")
    
    # Compute and display IPFS CID for the parquet file
    try:
        cidv1 = compute_ipfs_cids(parquet_path)

        print(f"Parquet file IPFS CID: {cidv1}")
    except Exception as e:
        print(f"Error computing IPFS CID: {str(e)}")