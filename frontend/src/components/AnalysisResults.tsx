import { AnalysisResultsProps } from '@/types/security';

/**
 * Get color classes for severity badges (dark theme)
 */
function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'text-red-300 bg-red-500/15 ring-1 ring-red-500/40';
    case 'high': return 'text-orange-300 bg-orange-500/15 ring-1 ring-orange-500/40';
    case 'medium': return 'text-yellow-300 bg-yellow-500/15 ring-1 ring-yellow-500/40';
    case 'low': return 'text-green-300 bg-green-500/15 ring-1 ring-green-500/40';
    default: return 'text-zinc-300 bg-zinc-500/15 ring-1 ring-zinc-500/40';
  }
}

const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;

/**
 * Analysis results display component with summary and issues table
 */
export default function AnalysisResults({
  analysisResults,
  isAnalyzing,
  error
}: AnalysisResultsProps) {
  return (
    <div className="panel p-5 flex flex-col">
      <h2 className="text-base font-semibold text-foreground mb-4 flex-shrink-0">
        Results of Analysis
      </h2>

      <div className="flex-1 overflow-auto">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-300 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}

        {!analysisResults && !error && !isAnalyzing && (
          <div className="bg-input-bg rounded-lg border border-zinc-800 p-4 text-sm text-muted text-center">
            Upload and analyze Python code to see security assessment results here.
          </div>
        )}

        {/* Skeleton while the agent works */}
        {!analysisResults && !error && isAnalyzing && (
          <div className="space-y-3 animate-pulse" aria-label="Analyzing code">
            <div className="h-16 rounded-lg bg-surface-2/70 border border-zinc-800" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="h-10 flex-1 rounded-md bg-surface-2/60" />
                <div className="h-10 w-20 rounded-md bg-surface-2/60" />
                <div className="h-10 w-12 rounded-md bg-surface-2/60" />
                <div className="h-10 flex-[2] rounded-md bg-surface-2/60" />
              </div>
            ))}
          </div>
        )}

        {analysisResults && (
          <div className="space-y-5">
            {/* Summary */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <h3 className="font-semibold text-blue-300 mb-2 text-sm">Analysis Summary</h3>
              <p className="text-blue-100/90 text-sm leading-relaxed">{analysisResults.summary}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {SEVERITIES.map((sev) => {
                  const count = analysisResults.issues.filter((i) => i.severity === sev).length;
                  return (
                    <span key={sev} className={`px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase ${getSeverityColor(sev)}`}>
                      {sev}: {count}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Issues Table */}
            {analysisResults.issues.length > 0 && (
              <div className="border border-zinc-800 rounded-lg overflow-hidden bg-input-bg">
                <div className="bg-surface-2/60 px-4 py-3 border-b border-zinc-800">
                  <h3 className="font-semibold text-foreground text-sm">
                    Security Issues Found ({analysisResults.issues.length})
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-zinc-900">
                      <tr>
                        {['Issue', 'Severity', 'CVSS', 'Description', 'Vulnerable Code', 'Recommended Fix'].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-zinc-800">
                      {analysisResults.issues.map((issue, index) => (
                        <tr key={index} className="hover:bg-zinc-800/40 align-top">
                          <td className="px-4 py-4 text-sm font-medium text-zinc-100">
                            {issue.title}
                          </td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex px-2 py-1 text-[11px] font-semibold rounded-full ${getSeverityColor(issue.severity)}`}>
                              {issue.severity.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm text-zinc-200 font-mono">
                            {issue.cvss_score}
                          </td>
                          <td className="px-4 py-4 text-sm text-zinc-300 max-w-xs leading-relaxed">
                            {issue.description}
                          </td>
                          <td className="px-4 py-4 text-xs font-mono bg-red-500/5 text-red-300 max-w-xs overflow-hidden">
                            <pre className="whitespace-pre-wrap break-words">{issue.code}</pre>
                          </td>
                          <td className="px-4 py-4 text-xs font-mono bg-green-500/5 text-green-300 max-w-xs overflow-hidden">
                            <pre className="whitespace-pre-wrap break-words">{issue.fix}</pre>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
