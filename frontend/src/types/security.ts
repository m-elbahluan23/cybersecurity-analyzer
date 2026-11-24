/**
 * Type definitions for security analysis components
 */

export interface SecurityIssue {
  title: string;
  description: string;
  code: string;
  fix: string;
  cvss_score: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface AnalysisResponse {
  summary: string;
  issues: SecurityIssue[];
}

export interface FileUploadProps {
  fileName: string;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onAnalyzeCode: () => void;
  isAnalyzing: boolean;
  hasCode: boolean;
}

export interface CodeInputProps {
  codeContent: string;
  fileName: string;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onAnalyzeCode: () => void;
  isAnalyzing: boolean;
}

/**
 * Pipeline steps streamed by POST /api/analyze/stream (in order)
 */
export type StepId =
  | 'received'
  | 'saved'
  | 'mcp'
  | 'agent'
  | 'scan'
  | 'findings'
  | 'review'
  | 'report';

export type StepStatus = 'pending' | 'active' | 'done' | 'skipped' | 'error';

export type StepStatuses = Record<StepId, StepStatus>;

export type StreamEvent =
  | { type: 'step'; id: StepId; status: Exclude<StepStatus, 'pending' | 'error'> }
  | { type: 'result'; report: AnalysisResponse }
  | { type: 'error'; message: string };

export interface AnalysisProgressProps {
  steps: StepStatuses;
}

export interface AnalysisResultsProps {
  analysisResults: AnalysisResponse | null;
  isAnalyzing: boolean;
  error: string | null;
}