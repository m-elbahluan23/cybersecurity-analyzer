"""
NoteKeeper - a tiny note-taking and backup service.

WARNING: This file is INTENTIONALLY INSECURE. It is a test sample for the
Cybersecurity Analyzer and contains deliberate vulnerabilities.
Do not run it on a real system or copy its patterns into real code.
"""

import hashlib
import os
import pickle
import random
import sqlite3
import subprocess
import tempfile
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

# Hardcoded credentials and secret key
ADMIN_PASSWORD = "admin123"
SECRET_KEY = "notekeeper-super-secret-key"
DB = "notes.db"
NOTES_DIR = "/srv/notekeeper/notes"
DEBUG = True


def init_db():
    with sqlite3.connect(DB) as conn:
        conn.execute("CREATE TABLE IF NOT EXISTS users (name TEXT, password TEXT)")
        conn.execute("CREATE TABLE IF NOT EXISTS notes (owner TEXT, title TEXT, body TEXT)")


def hash_password(password: str) -> str:
    # Weak, unsalted hash
    return hashlib.md5(password.encode()).hexdigest()


def register(name: str, password: str):
    with sqlite3.connect(DB) as conn:
        conn.execute(
            "INSERT INTO users VALUES ('%s', '%s')" % (name, hash_password(password))
        )


def login(name: str, password: str) -> bool:
    if password == ADMIN_PASSWORD:
        return True
    query = "SELECT * FROM users WHERE name = '%s' AND password = '%s'" % (
        name,
        hash_password(password),
    )
    with sqlite3.connect(DB) as conn:
        return conn.execute(query).fetchone() is not None


def make_session_token() -> str:
    # Predictable token from a non-cryptographic RNG
    return str(random.randint(100000, 999999))


def search_notes(owner: str, term: str):
    with sqlite3.connect(DB) as conn:
        return conn.execute(
            f"SELECT title, body FROM notes WHERE owner = '{owner}' AND body LIKE '%{term}%'"
        ).fetchall()


def read_note_file(filename: str) -> str:
    # Path traversal: filename like "../../etc/passwd" escapes NOTES_DIR
    with open(os.path.join(NOTES_DIR, filename)) as f:
        return f.read()


def backup_notes(archive_name: str) -> str:
    # Command injection: archive_name goes straight into a shell command
    cmd = f"tar -czf /tmp/{archive_name}.tar.gz {NOTES_DIR}"
    return subprocess.check_output(cmd, shell=True).decode()


def ping_server(host: str) -> str:
    # Command injection via os.system
    os.system("ping -c 1 " + host)
    return "pinged " + host


def import_notes(data: bytes):
    # Insecure deserialization of untrusted data
    return pickle.loads(data)


def fetch_note_from_url(url: str) -> str:
    # Server-side request forgery: fetches any URL, including internal ones
    with urllib.request.urlopen(url) as response:
        return response.read().decode()


def export_to_temp(text: str) -> str:
    # Insecure temporary file creation (race condition)
    path = tempfile.mktemp(suffix=".txt")
    with open(path, "w") as f:
        f.write(text)
    os.chmod(path, 0o777)
    return path


def run_formula(expression: str):
    # Code execution on user input
    return eval(expression)


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        params = parse_qs(urlparse(self.path).query)
        action = params.get("action", [""])[0]
        value = params.get("value", [""])[0]
        try:
            if action == "read":
                body = read_note_file(value)
            elif action == "backup":
                body = backup_notes(value)
            elif action == "ping":
                body = ping_server(value)
            elif action == "fetch":
                body = fetch_note_from_url(value)
            elif action == "calc":
                body = str(run_formula(value))
            elif action == "search":
                body = str(search_notes(params.get("owner", [""])[0], value))
            else:
                # Reflected XSS: user input echoed into HTML unescaped
                body = f"<h1>Unknown action: {action}</h1>"
            self.send_response(200)
        except Exception as e:
            # Leaks internals to the client
            body = f"Error: {e!r} (secret={SECRET_KEY})" if DEBUG else "Error"
            self.send_response(500)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(body.encode())


if __name__ == "__main__":
    init_db()
    # Listens on all interfaces with no authentication or TLS
    HTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
