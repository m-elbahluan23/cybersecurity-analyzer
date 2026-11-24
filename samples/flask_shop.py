"""
ShopLite - a small Flask web shop.

WARNING: This file is INTENTIONALLY INSECURE. It is a test sample for the
Cybersecurity Analyzer and contains deliberate vulnerabilities.
Do not run it on a real system or copy its patterns into real code.
"""

import os
import sqlite3

from flask import Flask, redirect, render_template_string, request, send_file, session

app = Flask(__name__)
app.secret_key = "shoplite-dev-key"  # Hardcoded, guessable session signing key
app.config["SESSION_COOKIE_HTTPONLY"] = False  # Cookie readable by JavaScript
app.config["SESSION_COOKIE_SECURE"] = False  # Cookie sent over plain HTTP

UPLOAD_DIR = "uploads"
DB = "shop.db"


def db():
    return sqlite3.connect(DB)


@app.route("/")
def home():
    name = request.args.get("name", "guest")
    # Server-side template injection: user input becomes part of the template
    return render_template_string("<h1>Welcome to ShopLite, " + name + "!</h1>")


@app.route("/login", methods=["POST"])
def login():
    user = request.form["user"]
    password = request.form["password"]
    row = db().execute(
        "SELECT id, is_admin FROM users WHERE name = ? AND password = ?", (user, password)
    ).fetchone()  # Passwords stored and compared in plain text
    if row:
        session["user_id"] = row[0]
        session["is_admin"] = row[1]
    # Open redirect: attacker controls where the user is sent after login
    return redirect(request.args.get("next", "/"))


@app.route("/order/<order_id>")
def view_order(order_id):
    # Insecure direct object reference: no check the order belongs to the user
    order = db().execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    return {"order": order}


@app.route("/profile", methods=["POST"])
def update_profile():
    # Mass assignment: any submitted field (including is_admin) is written
    fields = ", ".join(f"{key} = ?" for key in request.form)
    db().execute(
        f"UPDATE users SET {fields} WHERE id = ?",
        (*request.form.values(), session.get("user_id")),
    ).connection.commit()
    return "Profile updated"


@app.route("/transfer", methods=["POST"])
def transfer_credit():
    # No CSRF protection on a state-changing request
    amount = float(request.form["amount"])  # Negative amounts are not rejected
    to_user = request.form["to"]
    conn = db()
    conn.execute("UPDATE users SET credit = credit - ? WHERE id = ?", (amount, session["user_id"]))
    conn.execute("UPDATE users SET credit = credit + ? WHERE name = ?", (amount, to_user))
    conn.commit()
    return "Transferred"


@app.route("/upload", methods=["POST"])
def upload():
    file = request.files["file"]
    # Unrestricted upload: no type check, and the client controls the filename
    path = os.path.join(UPLOAD_DIR, file.filename)
    file.save(path)
    return "Saved to " + path


@app.route("/download")
def download():
    # Path traversal: ?file=../../app.py downloads any file
    return send_file(os.path.join(UPLOAD_DIR, request.args["file"]))


@app.route("/admin/delete_user/<int:user_id>")
def delete_user(user_id):
    # Broken access control: is_admin is trusted from the session and the action uses GET
    if session.get("is_admin") or request.args.get("admin") == "1":
        db().execute(f"DELETE FROM users WHERE id = {user_id}").connection.commit()
        return "Deleted"
    return "Forbidden", 403


@app.after_request
def add_headers(response):
    # Overly permissive CORS
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response


if __name__ == "__main__":
    # Debug mode exposes an interactive console that allows code execution
    app.run(host="0.0.0.0", port=5000, debug=True)
