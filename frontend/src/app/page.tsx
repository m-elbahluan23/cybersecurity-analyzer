'use client'

import { useState } from 'react';
import { AnalysisResponse, StepStatuses, StreamEvent } from '@/types/security';
import CodeInput from '@/components/CodeInput';
import AnalysisResults from '@/components/AnalysisResults';
import AnalysisProgress, { INITIAL_STEPS } from '@/components/AnalysisProgress';

// Force relative URLs in production builds
// Only use localhost when explicitly running in development mode
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 
  (process.env.NODE_ENV === 'development' && typeof window !== 'undefined' && window.location?.hostname === 'localhost' 
    ? 'http://localhost:8000' 
    : '');


/**
 * Main application page for cybersecurity code analysis
 */
export default function Home() {
  const [codeContent, setCodeContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [analysisResults, setAnalysisResults] = useState<AnalysisResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepStatuses>(INITIAL_STEPS);
  const [showProgress, setShowProgress] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.name.endsWith('.py')) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setCodeContent(content);
        setAnalysisResults(null);
        setError(null);
        setShowProgress(false);
      };
      reader.readAsText(file);
    } else {
      alert('Please select a Python (.py) file');
    }
  };

  const handleAnalyzeCode = async () => {
    if (!codeContent) {
      alert('Please upload a Python file first');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisResults(null);
    setSteps(INITIAL_STEPS);
    setShowProgress(true);

    const handleEvent = (event: StreamEvent) => {
      if (event.type === 'step') {
        setSteps((prev) => ({ ...prev, [event.id]: event.status }));
      } else if (event.type === 'result') {
        setAnalysisResults(event.report);
      } else if (event.type === 'error') {
        throw new Error(event.message);
      }
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/analyze/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: codeContent }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Read Server-Sent Events: blocks of "data: <json>" separated by a blank line
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let gotResult = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() ?? '';
        for (const block of blocks) {
          const line = block.split('\n').find((l) => l.startsWith('data: '));
          if (!line) continue;
          const event = JSON.parse(line.slice(6)) as StreamEvent;
          if (event.type === 'result') gotResult = true;
          handleEvent(event);
        }
      }
      if (!gotResult) {
        throw new Error('The analysis ended without a report');
      }
    } catch (err) {
      // Mark the step that was running as failed
      setSteps((prev) => {
        const next = { ...prev };
        const running = (Object.keys(next) as (keyof StepStatuses)[]).find((id) => next[id] === 'active');
        if (running) next[running] = 'error';
        return next;
      });
      setError(err instanceof Error ? err.message : 'An error occurred during analysis');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-surface-2 border border-zinc-700 flex items-center justify-center text-primary">
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </span>
            <div>
              <h1 className="text-2xl font-bold text-foreground leading-tight">Cybersecurity Analyst</h1>
              <p className="text-sm text-muted">AI agent for Python security review</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] font-mono">
            {['OpenAI Agents SDK', 'MCP', 'Semgrep', 'gpt-4.1-mini'].map((t) => (
              <span key={t} className="px-2 py-1 rounded-md bg-surface border border-zinc-800 text-muted">
                {t}
              </span>
            ))}
          </div>
        </header>

        <div className="flex flex-col gap-6 h-[calc(100vh-200px)]">
          <div className="flex-1 min-h-0 flex flex-col [&>*]:flex-1 [&>*]:min-h-0">
            <CodeInput
              codeContent={codeContent}
              fileName={fileName}
              onFileUpload={handleFileUpload}
              onAnalyzeCode={handleAnalyzeCode}
              isAnalyzing={isAnalyzing}
            />
          </div>

          {showProgress && <AnalysisProgress steps={steps} />}

          <div className="flex-1 min-h-0 flex flex-col [&>*]:flex-1 [&>*]:min-h-0">
            <AnalysisResults
              analysisResults={analysisResults}
              isAnalyzing={isAnalyzing}
              error={error}
            />
          </div>
        </div>
      </div>
    </div>
  );
}