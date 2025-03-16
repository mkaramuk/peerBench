import argparse
import polars as pl
from typing import Optional

def display_parquet(file_path: str, max_rows: Optional[int] = None, max_cols: Optional[int] = None):
    try:
        # Read the parquet file using polars
        df = pl.read_parquet(file_path)
        
        # Print basic information about the dataset
        print("\n=== Dataset Info ===")
        print(f"Number of rows: {df.height}")
        print(f"Number of columns: {df.width}")
        
        print("\n=== Column Names ===")
        print(df.columns)
        
        print("\n=== Data Types ===")
        print(df.schema)
        
        print("\n=== Data Preview ===")
        if max_rows:
            print(df.head(max_rows))
        else:
            print(df)
        
        # Print some basic statistics for numeric columns
        numeric_cols = [name for name, dtype in df.schema.items() if dtype in [pl.Float64, pl.Int64]]
        if numeric_cols:
            print("\n=== Numeric Columns Statistics ===")
            print(df.select(numeric_cols).describe())

    except Exception as e:
        print(f"Error reading/displaying Parquet file: {str(e)}")
        exit(1)

def main():
    parser = argparse.ArgumentParser(description='Display Parquet file contents with nice formatting')
    parser.add_argument('parquet_file', help='Path to input Parquet file')
    parser.add_argument('--max-rows', type=int, help='Maximum number of rows to display')
    parser.add_argument('--max-cols', type=int, help='Maximum number of columns to display')
    
    args = parser.parse_args()
    display_parquet(args.parquet_file, args.max_rows, args.max_cols)

if __name__ == "__main__":
    print("hi2 .\n")
    main()
