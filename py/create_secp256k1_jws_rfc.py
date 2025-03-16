import json
import binascii
from joserfc import jws
from joserfc.jwk import ECKey
from ecdsa import SigningKey, SECP256k1
import base64

def create_secp256k1_jws():
    # The private key (in hex)
    private_key_hex = "67499ec186126dcdb98f2af7f396d1b410cc979959b56fb3bc6ca5d294e76bb2"
    private_key_bytes = binascii.unhexlify(private_key_hex)
    
    # Create ECDSA signing key and get public key points
    signing_key = SigningKey.from_string(private_key_bytes, curve=SECP256k1)
    verifying_key = signing_key.get_verifying_key()
    
    # Get public key coordinates
    x_coord = verifying_key.pubkey.point.x()
    y_coord = verifying_key.pubkey.point.y()
    
    # Convert coordinates to base64url
    x_b64 = base64.urlsafe_b64encode(x_coord.to_bytes(32, 'big')).rstrip(b'=').decode('ascii')
    y_b64 = base64.urlsafe_b64encode(y_coord.to_bytes(32, 'big')).rstrip(b'=').decode('ascii')
    d_b64 = base64.urlsafe_b64encode(private_key_bytes).rstrip(b'=').decode('ascii')
    
    # Create EC Key with all required parameters
    key = ECKey.import_key({
        "kty": "EC",
        "crv": "secp256k1",
        "x": x_b64,
        "y": y_b64,
        "d": d_b64
    })
    
    # The message to sign
    payload = json.dumps({"hello": "world"}).encode('utf-8')
    
    try:
        # Create protected header
        protected = {"alg": "ES256K"}
        
        # Create JWS signature
        token = jws.serialize_compact(protected, payload, key)
        
        print("\nPayload:")
        print(json.dumps({"hello": "world"}, indent=2))
        print("\nJWS Token:")
        print(token)
        
        # Verify the signature
        try:
            verified = jws.verify_compact(token, key)
            print("\nSignature verified successfully!")
            print("Verified payload:", json.loads(verified.payload))
        except Exception as e:
            print("\nSignature verification failed:", str(e))
            
    except Exception as e:
        print(f"Error creating JWS: {str(e)}")
        exit(1)

if __name__ == "__main__":
    print("hello511.\n")
    create_secp256k1_jws()
