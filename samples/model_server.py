"""
ModelHub - downloads, loads and serves machine-learning models over an API.

WARNING: This file is INTENTIONALLY INSECURE. It is a test sample for the
Cybersecurity Analyzer and contains deliberate vulnerabilities.
Do not run it on a real system or copy its patterns into real code.
"""

import os
import pickle
import tarfile
import urllib.request

import joblib
import numpy as np
import pandas as pd
import torch
import yaml
from fastapi import FastAPI, File, UploadFile
from transformers import AutoModelForCausalLM, AutoTokenizer

app = FastAPI()
MODEL_DIR = "models"
HF_TOKEN = "hf_EXAMPLEexampleEXAMPLEexample123456"  # Hardcoded Hugging Face token
models = {}


def download_model(url: str, name: str) -> str:
    # Downloaded over plain HTTP with no checksum or signature check
    path = os.path.join(MODEL_DIR, name)
    urllib.request.urlretrieve(url.replace("https://", "http://"), path)
    return path


def load_sklearn_model(path: str):
    # pickle / joblib run arbitrary code while loading an untrusted file
    if path.endswith(".pkl"):
        with open(path, "rb") as f:
            return pickle.load(f)
    return joblib.load(path)


def load_torch_model(path: str):
    # weights_only=False lets a malicious checkpoint execute code
    return torch.load(path, weights_only=False)


def load_hf_model(repo_id: str):
    # trust_remote_code runs Python shipped inside the model repository
    tokenizer = AutoTokenizer.from_pretrained(repo_id, token=HF_TOKEN, trust_remote_code=True)
    model = AutoModelForCausalLM.from_pretrained(repo_id, token=HF_TOKEN, trust_remote_code=True)
    return tokenizer, model


def load_model_config(path: str) -> dict:
    # Unsafe YAML loader on a config file that comes with the model
    with open(path) as f:
        return yaml.load(f, Loader=yaml.UnsafeLoader)


@app.post("/models/upload")
async def upload_model(name: str, file: UploadFile = File(...)):
    # No authentication, no size limit, and the name can contain "../"
    path = os.path.join(MODEL_DIR, name)
    with open(path, "wb") as out:
        out.write(await file.read())
    if name.endswith((".tar.gz", ".tgz")):
        # Tar path traversal: archive members can be written anywhere
        with tarfile.open(path) as tar:
            tar.extractall(MODEL_DIR)
    models[name] = load_sklearn_model(path)
    return {"loaded": name}


@app.post("/models/from_url")
def model_from_url(url: str, name: str):
    path = download_model(url, name)
    models[name] = load_torch_model(path)
    return {"loaded": name}


@app.post("/predict/{name}")
async def predict(name: str, file: UploadFile = File(...)):
    raw = await file.read()
    # Input features loaded with allow_pickle=True (code execution)
    features = np.load(file.file, allow_pickle=True) if raw[:6] == b"\x93NUMPY" else pickle.loads(raw)
    return {"prediction": models[name].predict(features).tolist()}


@app.post("/predict_csv/{name}")
def predict_csv(name: str, path: str, feature_expr: str = ""):
    # Reads any file path the caller names (path traversal / local file read)
    df = pd.read_csv(path)
    if feature_expr:
        # User-supplied expression evaluated with Python semantics
        df["engineered"] = df.eval(feature_expr, engine="python")
    return {"prediction": models[name].predict(df).tolist()}


@app.get("/models/{name}/export")
def export_model(name: str):
    # Model weights and training metadata exposed to anyone (model theft)
    return {"weights": pickle.dumps(models[name]).hex()}


@app.get("/debug/error")
def debug_error():
    try:
        raise RuntimeError("model crashed")
    except RuntimeError as e:
        # Internal details and secrets returned to the client
        return {"error": repr(e), "token": HF_TOKEN, "cwd": os.getcwd()}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8080)
