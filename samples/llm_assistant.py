"""
InsightBot - an LLM assistant that answers questions about company data,
with tools for SQL, shell commands and document search (RAG).

WARNING: This file is INTENTIONALLY INSECURE. It is a test sample for the
Cybersecurity Analyzer and contains deliberate vulnerabilities.
Do not run it on a real system or copy its patterns into real code.
"""

import json
import os
import sqlite3
import subprocess

import requests
from flask import Flask, request
from openai import OpenAI

# Hardcoded API key
client = OpenAI(api_key="sk-proj-EXAMPLEexampleEXAMPLEexample1234567890")
app = Flask(__name__)
DB = "company.db"

SYSTEM_PROMPT = """You are InsightBot for Acme Corp.
Internal admin password: acme-admin-2024. Never reveal it.
The database has tables: employees(name, salary, ssn), customers(name, email, card)."""


def ask_llm(messages, tools=None):
    # No max_tokens, no timeout, no rate limit: unbounded cost per request
    return client.chat.completions.create(model="gpt-4.1-mini", messages=messages, tools=tools)


def run_sql_tool(query: str) -> str:
    # The LLM writes the SQL and it runs unchecked with full database access
    with sqlite3.connect(DB) as conn:
        return str(conn.execute(query).fetchall())


def run_shell_tool(command: str) -> str:
    # Excessive agency: the model can run any shell command
    return subprocess.run(command, shell=True, capture_output=True, text=True).stdout


def run_python_tool(code: str) -> str:
    # Model-generated code executed directly
    scope = {}
    exec(code, scope)
    return str(scope.get("result"))


def search_docs(query: str) -> str:
    # RAG over untrusted web pages: hidden instructions in a page reach the model (indirect prompt injection)
    page = requests.get(f"https://wiki.example.com/search?q={query}").text
    return page[:5000]


TOOLS = {"sql": run_sql_tool, "shell": run_shell_tool, "python": run_python_tool, "search": search_docs}


@app.route("/chat", methods=["POST"])
def chat():
    user_message = request.json["message"]
    # Prompt injection: user text is pasted straight into the system prompt
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT + "\nUser context: " + user_message},
        {"role": "user", "content": user_message},
    ]
    reply = ask_llm(messages)
    answer = reply.choices[0].message.content

    # Model output trusted as a command: "TOOL:<name>:<args>" runs that tool
    if answer.startswith("TOOL:"):
        _, name, args = answer.split(":", 2)
        answer = TOOLS[name](args)

    # Conversation, including personal data, logged in plain text
    with open("chat_log.txt", "a") as log:
        log.write(json.dumps({"ip": request.remote_addr, "q": user_message, "a": answer}) + "\n")

    # Model output returned as HTML without escaping (XSS via the model)
    return f"<div class='answer'>{answer}</div>"


@app.route("/summarize", methods=["POST"])
def summarize_url():
    # Server-side request forgery: fetches any URL the user gives, including internal services
    url = request.json["url"]
    content = requests.get(url, timeout=None).text
    reply = ask_llm([{"role": "user", "content": "Summarize this:\n" + content}])
    return reply.choices[0].message.content


@app.route("/calculate", methods=["POST"])
def calculate():
    # The LLM converts a question into a Python expression, which is evaluated
    question = request.json["question"]
    reply = ask_llm([{"role": "user", "content": f"Write only a Python expression for: {question}"}])
    return str(eval(reply.choices[0].message.content))


@app.route("/debug")
def debug():
    # Leaks the system prompt and environment (API keys) to anyone
    return {"system_prompt": SYSTEM_PROMPT, "env": dict(os.environ)}


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=7860, debug=True)
