"""
SecureVault - encryption, token and API-client helpers.

WARNING: This file is INTENTIONALLY INSECURE. It is a test sample for the
Cybersecurity Analyzer and contains deliberate vulnerabilities.
Do not run it on a real system or copy its patterns into real code.
"""

import base64
import hashlib
import random
import ssl
import string

import jwt
import requests
from Crypto.Cipher import AES, DES

# Hardcoded keys and credentials
AES_KEY = b"0123456789abcdef"
STATIC_IV = b"\x00" * 16
JWT_SECRET = "secret"
AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE"
AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
PAYMENT_API_TOKEN = "pay_live_EXAMPLE_NOT_A_REAL_TOKEN"


def encrypt_ecb(data: bytes) -> bytes:
    # ECB mode leaks patterns in the plaintext
    cipher = AES.new(AES_KEY, AES.MODE_ECB)
    return cipher.encrypt(data.ljust(32, b" "))


def encrypt_cbc(data: bytes) -> bytes:
    # Static, all-zero IV makes encryption deterministic
    cipher = AES.new(AES_KEY, AES.MODE_CBC, STATIC_IV)
    return cipher.encrypt(data.ljust(32, b" "))


def encrypt_legacy(data: bytes) -> bytes:
    # DES is broken (56-bit key)
    return DES.new(b"8bytekey", DES.MODE_ECB).encrypt(data.ljust(16, b" "))


def obfuscate_password(password: str) -> str:
    # Base64 is encoding, not encryption
    return base64.b64encode(password.encode()).decode()


def hash_password(password: str) -> str:
    # SHA-1 without salt or key stretching
    return hashlib.sha1(password.encode()).hexdigest()


def generate_api_key(length: int = 20) -> str:
    # Predictable: random is not a cryptographic RNG, and it is seeded with a constant
    random.seed(42)
    return "".join(random.choice(string.ascii_letters + string.digits) for _ in range(length))


def generate_reset_code() -> str:
    return str(random.randint(1000, 9999))  # Only 9000 possibilities


def check_api_key(supplied: str, expected: str) -> bool:
    # Non-constant-time comparison allows timing attacks
    return supplied == expected


def create_token(user_id: int) -> str:
    # No expiry claim, weak secret
    return jwt.encode({"user_id": user_id, "role": "user"}, JWT_SECRET, algorithm="HS256")


def read_token(token: str) -> dict:
    # Signature verification disabled: anyone can forge a token
    return jwt.decode(token, options={"verify_signature": False})


def read_token_any_alg(token: str) -> dict:
    # Accepts "none" algorithm
    return jwt.decode(token, JWT_SECRET, algorithms=["HS256", "none"])


def call_payment_api(amount: float) -> dict:
    # TLS certificate verification disabled
    response = requests.post(
        "https://api.payments.example.com/charge",
        json={"amount": amount},
        headers={"Authorization": f"Bearer {PAYMENT_API_TOKEN}"},
        verify=False,
    )
    return response.json()


def fetch_rates() -> str:
    # Plain HTTP for sensitive data, and no timeout
    return requests.get("http://rates.example.com/latest").text


def legacy_tls_context() -> ssl.SSLContext:
    # Hostname checks off, no certificate validation, outdated protocol
    context = ssl.SSLContext(ssl.PROTOCOL_TLSv1)
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    return context


def log_login(user: str, password: str):
    # Secrets written to logs
    print(f"login attempt user={user} password={password} key={AES_KEY!r}")
