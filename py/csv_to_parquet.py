import argparse
import pandas as pd
import os

def convert_csv_to_parquet(input_csv, output_parquet=None):
    try:
        # Read CSV
        df = pd.read_csv(input_csv)
        
        # If no output path specified, use input path with .parquet extension
        if output_parquet is None:
            output_parquet = os.path.splitext(input_csv)[0] + '.parquet'
        
        # Save as Parquet
        df.to_parquet(output_parquet, engine='pyarrow')
        return output_parquet
    except Exception as e:
        raise Exception(f"Conversion failed: {str(e)}")

def main():
    parser = argparse.ArgumentParser(description='Convert CSV file to Parquet format')
    parser.add_argument('input_csv', help='Path to input CSV file')
    parser.add_argument('--output', '-o', help='Path to output Parquet file (optional)')
    
    args = parser.parse_args()
    
    try:
        output_path = convert_csv_to_parquet(args.input_csv, args.output)
        print(f"Successfully converted to: {output_path}")
    except Exception as e:
        print(f"Error: {e}")
        exit(1)

if __name__ == "__main__":
    main()
