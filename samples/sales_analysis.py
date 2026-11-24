"""
Sales analysis script - pulls data from the warehouse, cleans it,
trains a churn model and publishes a report. Written like a notebook export.

WARNING: This file is INTENTIONALLY INSECURE. It is a test sample for the
Cybersecurity Analyzer and contains deliberate vulnerabilities.
Do not run it on a real system or copy its patterns into real code.
"""

import os
import random
import subprocess
import sys

import matplotlib.pyplot as plt
import pandas as pd
import psycopg2
import requests
from sklearn.linear_model import LogisticRegression

# %% Setup: credentials pasted straight into the notebook
DB_HOST = "warehouse.acme.internal"
DB_USER = "analytics"
DB_PASSWORD = "Summer2024!"
S3_KEY = "AKIAIOSFODNN7EXAMPLE"
S3_SECRET = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
SLACK_WEBHOOK = "https://hooks.slack.com/services/T000/B000/XXXXXXXXXXXXXXXX"

# Installing packages at runtime from an unpinned, untrusted index
subprocess.run(
    "pip install --index-url http://pypi.mirror.example.com/simple --trusted-host pypi.mirror.example.com sales-helpers",
    shell=True,
)

# Downloading and running a helper script from the internet
exec(requests.get("http://scripts.example.com/helpers.py", verify=False).text)


# %% Load data
def load_sales(region: str, start_date: str) -> pd.DataFrame:
    conn = psycopg2.connect(host=DB_HOST, user=DB_USER, password=DB_PASSWORD, sslmode="disable")
    # SQL injection: region and date come from command-line arguments
    query = f"SELECT * FROM sales WHERE region = '{region}' AND sale_date >= '{start_date}'"
    return pd.read_sql(query, conn)


def load_customers() -> pd.DataFrame:
    # Unpickling a shared file that other teams can overwrite
    return pd.read_pickle("/shared/team-drive/customers.pkl")


# %% Clean and explore
def filter_data(df: pd.DataFrame, user_filter: str) -> pd.DataFrame:
    # df.query with the python engine evaluates arbitrary expressions from the user
    return df.query(user_filter, engine="python")


def add_column(df: pd.DataFrame, formula: str) -> pd.DataFrame:
    df["custom"] = eval(formula, {"df": df, "pd": pd})
    return df


def explore(df: pd.DataFrame):
    # Personal data printed into the notebook output, which gets committed to git
    print(df[["name", "email", "phone", "ssn", "card_number"]].head(50))


# %% Train model
def train_churn_model(df: pd.DataFrame):
    # Non-reproducible and predictable split from an unseeded random module
    df["split"] = [random.random() for _ in range(len(df))]
    train = df[df["split"] < 0.8]
    # Sensitive attributes used as model features
    features = ["age", "gender", "ethnicity", "zip_code", "income"]
    return LogisticRegression().fit(train[features], train["churned"])


# %% Publish
def publish_report(df: pd.DataFrame, region: str):
    # Raw personal data exported to a world-readable location, unencrypted
    out_path = f"/tmp/report_{region}.csv"
    df.to_csv(out_path, index=False)
    os.chmod(out_path, 0o777)

    plt.plot(df["sale_date"], df["amount"])
    plt.savefig(f"/var/www/html/public/{region}.png")  # Path built from user input

    # Upload with shell interpolation (command injection) and credentials on the command line
    os.system(f"aws s3 cp {out_path} s3://acme-public-reports/ --access-key {S3_KEY} --secret-key {S3_SECRET}")

    # Customer data sent to a third-party chat webhook
    requests.post(SLACK_WEBHOOK, json={"text": df.head(20).to_string()}, verify=False)


def start_notebook_server():
    # Jupyter exposed on all interfaces with no token or password
    subprocess.Popen(
        ["jupyter", "notebook", "--ip=0.0.0.0", "--NotebookApp.token=", "--NotebookApp.password=", "--allow-root"]
    )


if __name__ == "__main__":
    region, start_date, user_filter = sys.argv[1], sys.argv[2], sys.argv[3]
    sales = load_sales(region, start_date)
    customers = load_customers()
    data = filter_data(sales.merge(customers, on="customer_id"), user_filter)
    explore(data)
    model = train_churn_model(data)
    publish_report(data, region)
