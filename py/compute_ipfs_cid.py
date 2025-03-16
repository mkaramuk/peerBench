import argparse
import hashlib
import base64
import base58
import struct
#TODO redo this with some library I just don't know which one we want to use https://github.com/hashberg-io/multiformats   or https://github.com/PancakesArchitect/py-multiformats-cid      have not been touched for a while but i guess its a simple algo that doesn't need to be touched 

def compute_ipfs_cids(file_path: str) -> tuple[str, str, str]:
    print("hello3")
    try:
        # Read file in binary mode
        with open(file_path, 'rb') as f:
            file_data = f.read()

        # Compute SHA2-256 hash of raw data
        h = hashlib.sha256(file_data).digest()
        print(f"SHA256 raw digest: {h.hex()}")
        
        # Construct the multihash
        # 0x12 = sha2-256 identifier
        # 0x20 = length (32 bytes) of sha2-256 hash
        multihash = bytes([0x12, 0x20]) + h
        
        # CIDv0 (base58btc)
        cidv0 = base58.b58encode(multihash).decode('utf-8')
        
        # CIDv1 with raw codec (base32)
        # 0x01 = CID version 1
        # 0x55 = raw binary codec
        cidv1_bytes = bytes([0x01, 0x55]) + multihash
        cidv1_base32 = 'b' + base64.b32encode(cidv1_bytes).decode('utf-8').lower()
        

        return   cidv1_base32
        
    except Exception as e:
        raise Exception(f"Failed to compute CID: {str(e)}")

def main():
    parser = argparse.ArgumentParser(description='Compute IPFS CID for a file using SHA2-256')
    parser.add_argument('file_path', help='Path to the file')
    
    args = parser.parse_args()
    
    try:
        cidv1_raw = compute_ipfs_cids(args.file_path) 
        print(f"IPFS CIDv1 (base32, raw): {cidv1_raw}")
        
    except Exception as e:
        print(f"Error: {e}")
        exit(1)

if __name__ == "__main__":
    main()
