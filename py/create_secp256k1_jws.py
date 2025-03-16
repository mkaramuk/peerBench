import json
from jose import jws
from jose.constants import ALGORITHMS
from ecdsa import SigningKey
import binascii

def create_secp256k1_jws():
    # The private key (in hex)
    private_key_hex = "67499ec186126dcdb98f2af7f396d1b410cc979959b56fb3bc6ca5d294e76bb2"
    
    # Convert hex private key to bytes
    private_key_bytes = binascii.unhexlify(private_key_hex)
    
    # Create signing key from private key bytes
    signing_key = SigningKey.from_string(private_key_bytes, curve=ALGORITHMS.ES256K)
    
    # The message to sign
    payload = {
        "hello": "world"
    }
    
    try:
        # Create JWS signature
        signature = jws.sign(payload, signing_key, algorithm=ALGORITHMS.ES256K)
        
        print("\nPayload:")
        print(json.dumps(payload, indent=2))
        print("\nJWS Signature:")
        print(signature)
        
        # Verify the signature (optional verification step)
        verify_key = signing_key.get_verifying_key()
        try:
            verified_payload = jws.verify(signature, verify_key, algorithms=ALGORITHMS.ES256K)
            print("\nSignature verified successfully!")
            print("Verified payload:", json.loads(verified_payload))
        except Exception as e:
            print("\nSignature verification failed:", str(e))
            
    except Exception as e:
        print(f"Error creating JWS: {str(e)}")
        exit(1)

if __name__ == "__main__":
    print("hello5.\n")
    create_secp256k1_jws()
