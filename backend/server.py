import json
import tempfile  # to create a file on disk for semgrep_scan
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import AsyncIterator, List
from dotenv import load_dotenv
from agents import Agent, Runner, trace

from context import SECURITY_RESEARCHER_INSTRUCTIONS, get_analysis_prompt, enhance_summary
from mcp_servers import create_semgrep_server

load_dotenv(override=True)

app = FastAPI(title="Cybersecurity Analyzer API")

# Configure CORS for development and production
cors_origins = [
    "http://localhost:3000",  # Local development
    "http://frontend:3000",  # Docker development
]

# In production, allow same-origin requests (static files served from same domain)
if os.getenv("ENVIRONMENT") == "production":
    cors_origins.append(
        "*"
    )  # Allow all origins in production since we serve frontend from same domain

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    code: str


class SecurityIssue(BaseModel):
    title: str = Field(description="Brief title of the security vulnerability")
    description: str = Field(
        description="Detailed description of the security issue and its potential impact"
    )
    code: str = Field(
        description="The specific vulnerable code snippet that demonstrates the issue"
    )
    fix: str = Field(description="Recommended code fix or mitigation strategy")
    cvss_score: float = Field(description="CVSS score from 0.0 to 10.0 representing severity")
    severity: str = Field(description="Severity level: critical, high, medium, or low")


class SecurityReport(BaseModel):
    summary: str = Field(description="Executive summary of the security analysis")
    issues: List[SecurityIssue] = Field(description="List of identified security vulnerabilities")


def validate_request(request: AnalyzeRequest) -> None:
    """Validate the analysis request."""
    if not request.code.strip():
        raise HTTPException(status_code=400, detail="No code provided for analysis")


def check_api_keys() -> None:
    """Verify required API keys are configured."""
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")


def create_security_agent(semgrep_server) -> Agent:
    """Create and configure the security analysis agent."""
    return Agent(
        name="Security Researcher",
        instructions=SECURITY_RESEARCHER_INSTRUCTIONS,
        model="gpt-4.1-mini",
        mcp_servers=[semgrep_server],
        output_type=SecurityReport,
    )


def step(step_id: str, status: str) -> dict:
    """Progress event for one pipeline step (status: active | done | skipped)."""
    return {"type": "step", "id": step_id, "status": status}


async def run_security_analysis(code: str) -> AsyncIterator[dict]:
    """
    Execute the security analysis workflow, yielding progress events.

    Step ids (in order): received, saved, mcp, agent, scan, findings, review, report.
    The last event is {"type": "result", "report": SecurityReport}.
    """
    yield step("received", "done")

    with tempfile.NamedTemporaryFile(  # Creates a temporary file locally with the code
        mode="w", suffix=".py", delete=False
    ) as temp:
        temp.write(code)
        temp_path = temp.name
    yield step("saved", "done")

    try:
        with trace("Security Researcher"):
            yield step("mcp", "active")
            async with create_semgrep_server() as semgrep:
                yield step("mcp", "done")
                yield step("agent", "active")
                agent = create_security_agent(semgrep)

                # Sends code and path to the file; stream events to track the agent's steps
                result = Runner.run_streamed(agent, input=get_analysis_prompt(code, temp_path))
                scanned = False
                reviewing = False
                async for event in result.stream_events():
                    if event.type != "run_item_stream_event":
                        continue
                    if event.name == "tool_called" and not scanned:
                        yield step("agent", "done")
                        yield step("scan", "active")
                    elif event.name == "tool_output" and not scanned:
                        scanned = True
                        yield step("scan", "done")
                        yield step("findings", "done")
                        yield step("review", "active")
                        reviewing = True

                if not scanned:  # The agent answered without calling Semgrep
                    yield step("agent", "done")
                    yield step("scan", "skipped")
                    yield step("findings", "skipped")
                if not reviewing:
                    yield step("review", "active")
                yield step("review", "done")

                yield step("report", "active")
                # Sort issues by CVSS in descending order
                report = result.final_output_as(SecurityReport)
                report.issues.sort(key=lambda issue: issue.cvss_score, reverse=True)
                report = format_analysis_response(code, report)
                yield step("report", "done")
                yield {"type": "result", "report": report.model_dump()}
    except Exception as err:
        print(f"Unexpected {err=}, {type(err)=}")
        raise
    finally:
        try:
            os.unlink(temp_path)
        except OSError:
            pass


def format_analysis_response(code: str, report: SecurityReport) -> SecurityReport:
    """Format the final analysis response."""
    enhanced_summary = enhance_summary(len(code), report.summary)
    return SecurityReport(summary=enhanced_summary, issues=report.issues)


@app.post("/api/analyze", response_model=SecurityReport)
async def analyze_code(request: AnalyzeRequest) -> SecurityReport:
    """
    Analyze Python code for security vulnerabilities using OpenAI Agents and Semgrep.

    This endpoint combines static analysis via Semgrep with AI-powered security analysis
    to provide comprehensive vulnerability detection and remediation guidance.
    """
    validate_request(request)
    check_api_keys()

    try:
        report = None
        async for event in run_security_analysis(request.code):  # run to completion (cleanup)
            if event["type"] == "result":
                report = SecurityReport(**event["report"])
        if report is None:
            raise RuntimeError("Analysis finished without a report")
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/api/analyze/stream")
async def analyze_code_stream(request: AnalyzeRequest) -> StreamingResponse:
    """
    Same analysis as /api/analyze, streamed as Server-Sent Events.

    Each event is `data: <json>`: step progress, then a final `result` (or `error`).
    """
    validate_request(request)
    check_api_keys()

    async def event_stream():
        try:
            async for event in run_security_analysis(request.code):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': f'Analysis failed: {e}'})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"message": "Cybersecurity Analyzer API"}


# Mount static files for frontend
if os.path.exists("static"):
    app.mount("/", StaticFiles(directory="static", html=True), name="static")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
