"""
DataFlow - imports customer files, processes them and generates reports.

WARNING: This file is INTENTIONALLY INSECURE. It is a test sample for the
Cybersecurity Analyzer and contains deliberate vulnerabilities.
Do not run it on a real system or copy its patterns into real code.
"""

import logging
import marshal
import os
import re
import shelve
import subprocess
import tarfile
import zipfile
from xml.dom import pulldom

import yaml
from lxml import etree

logging.basicConfig(level=logging.DEBUG, filename="pipeline.log")
log = logging.getLogger("dataflow")

DB_PASSWORD = "Pr0duction!2024"
WORK_DIR = "/var/dataflow/work"


def load_config(path: str) -> dict:
    # yaml.load with the unsafe loader can construct arbitrary Python objects
    with open(path) as f:
        return yaml.load(f, Loader=yaml.Loader)


def parse_customer_xml(xml_bytes: bytes):
    # XML external entities enabled (XXE): can read local files or reach internal hosts
    parser = etree.XMLParser(resolve_entities=True, no_network=False, load_dtd=True)
    return etree.fromstring(xml_bytes, parser)


def stream_orders(xml_path: str):
    # Unsafe XML parsing with the standard library (entity expansion)
    return pulldom.parse(xml_path)


def extract_upload(archive_path: str):
    # Tar path traversal: members like "../../etc/cron.d/job" escape WORK_DIR
    with tarfile.open(archive_path) as tar:
        tar.extractall(WORK_DIR)


def extract_zip(zip_path: str):
    # Zip slip: entry names are joined without validation
    with zipfile.ZipFile(zip_path) as archive:
        for name in archive.namelist():
            target = os.path.join(WORK_DIR, name)
            with open(target, "wb") as out:
                out.write(archive.read(name))


def load_cached_job(cache_file: str):
    # marshal and shelve (pickle) on files that users can supply
    with open(cache_file, "rb") as f:
        job = marshal.load(f)
    with shelve.open(cache_file + ".db") as cache:
        return job, cache.get("state")


def validate_email(email: str) -> bool:
    # Catastrophic backtracking (ReDoS) on crafted input
    return re.match(r"^([a-zA-Z0-9]+)*@([a-zA-Z0-9]+\.)+[a-zA-Z]+$", email) is not None


def convert_report(input_file: str, output_format: str) -> str:
    # Command injection through string interpolation with shell=True
    return subprocess.run(
        f"libreoffice --headless --convert-to {output_format} {input_file}",
        shell=True,
        capture_output=True,
        text=True,
    ).stdout


def run_user_script(script_name: str):
    # Runs an arbitrary program chosen by the user, with the full parent environment
    subprocess.Popen([script_name], env=os.environ)


def apply_transform(row: dict, rule: str):
    # Executes rule text from the uploaded file
    exec(rule, {"row": row})
    return row


def delete_job(job_id: str, user_role: str):
    # assert is removed when Python runs with -O, so this check disappears
    assert user_role == "admin", "only admins can delete jobs"
    os.system(f"rm -rf {WORK_DIR}/{job_id}")


def save_report(name: str, content: str):
    path = os.path.join("/tmp", name)
    with open(path, "w") as f:
        f.write(content)
    os.chmod(path, 0o666)  # World-writable report file


def connect_warehouse(user: str):
    dsn = f"postgresql://{user}:{DB_PASSWORD}@warehouse.internal:5432/sales"
    # Credentials and personal data written to the debug log
    log.debug("connecting with dsn=%s", dsn)
    return dsn


def process_customer(record: dict):
    log.info("processing customer %s card=%s ssn=%s", record["name"], record["card"], record["ssn"])
    try:
        return int(record["amount"]) / int(record["quantity"])
    except Exception:
        pass  # Errors silently swallowed
