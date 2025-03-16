import jwt
import json
import binascii
from ecdsa import SigningKey, SECP256k1
from ecdsa.util import sigencode_der
import base64

def create_key_pair(private_key_hex: str):
    private_key_bytes = binascii.unhexlify(private_key_hex)
    signing_key = SigningKey.from_string(private_key_bytes, curve=SECP256k1)
    verifying_key = signing_key.get_verifying_key()
    return signing_key, verifying_key

def create_secp256k1_jwt():
    signing_key, verifying_key = create_key_pair(
        "67499ec186126dcdb98f2af7f396d1b410cc979959b56fb3bc6ca5d294e76bb2"
    )
    
    payload = {
        "hello": "world"
    }
    
    try:
        # Create JWT with ES256K algorithm
        token = jwt.encode(
            payload,
            signing_key.to_pem(),
            algorithm="ES256K"
        )
        
        print("\nJWT Creation:")
        print("Payload:", json.dumps(payload, indent=2))
        print("JWT Token:", token)
        
        # Verify JWT
        verified_payload = jwt.decode(
            token,
            verifying_key.to_pem(),
            algorithms=["ES256K"]
        )
        print("JWT Verification successful!")
        
    except Exception as e:
        print(f"Error with JWT: {str(e)}")
        exit(1)

def create_secp256k1_jws():
    signing_key, verifying_key = create_key_pair(
        "67499ec186126dcdb98f2af7f396d1b410cc979959b56fb3bc6ca5d294e76bb2"
    )
    
    payload = {
        "hello": "world"
    }
    
    try:
        # Create JWS with ES256K algorithm
        header = {
            "alg": "ES256K",
            "typ": "JWS"
        }
        
        token = jwt.encode(
            payload,
            signing_key.to_pem(),
            algorithm="ES256K",
            headers=header
        )
        
        print("\nJWS Creation:")
        print("Payload:", json.dumps(payload, indent=2))
        print("JWS Token:", token)
        
        # Verify JWS
        verified_payload = jwt.decode(
            token,
            verifying_key.to_pem(),
            algorithms=["ES256K"]
        )
        print("JWS Verification successful!")
        
    except Exception as e:
        print(f"Error with JWS: {str(e)}")
        exit(1)

if __name__ == "__main__":
    print("Creating JWT and JWS examples... 2")
    create_secp256k1_jwt()
    create_secp256k1_jws()
