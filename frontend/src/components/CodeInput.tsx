import { CodeInputProps } from '@/types/security';
import FileUpload from './FileUpload';

/**
 * Code input section with file upload and code display
 */
export default function CodeInput({
  codeContent,
  fileName,
  onFileUpload,
  onAnalyzeCode,
  isAnalyzing
}: CodeInputProps) {
  const lines = codeContent ? codeContent.split('\n').length : 0;

  return (
    <div className="panel p-5 flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 flex-shrink-0">
        <div>
          <label htmlFor="code-input" className="text-base font-semibold text-foreground">
            Code to analyze
          </label>
          {lines > 0 && <p className="text-[11px] font-mono text-muted">{lines} lines · {codeContent.length} chars</p>}
        </div>

        <FileUpload
          fileName={fileName}
          onFileUpload={onFileUpload}
          onAnalyzeCode={onAnalyzeCode}
          isAnalyzing={isAnalyzing}
          hasCode={!!codeContent}
        />
      </div>

      <textarea
        id="code-input"
        value={codeContent}
        readOnly
        placeholder="Select a Python file to display its contents here..."
        className="flex-1 w-full resize-none border border-zinc-800 rounded-lg p-4 font-mono text-sm leading-relaxed bg-input-bg text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </div>
  );
}
