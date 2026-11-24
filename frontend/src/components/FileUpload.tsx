import { FileUploadProps } from '@/types/security';

/**
 * File upload button component for selecting Python files
 */
export default function FileUpload({
  fileName,
  onFileUpload,
  onAnalyzeCode,
  isAnalyzing,
  hasCode
}: FileUploadProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {fileName && (
        <span className="text-xs font-mono text-secondary bg-green-500/10 border border-green-500/25 px-3 py-1 rounded-full">
          {fileName}
        </span>
      )}

      <input
        type="file"
        accept=".py"
        onChange={onFileUpload}
        className="hidden"
        id="file-upload"
      />

      <label
        htmlFor="file-upload"
        className="bg-surface-2 hover:bg-zinc-700 border border-zinc-700 text-foreground px-4 py-2 rounded-lg cursor-pointer transition-colors text-sm font-medium"
      >
        Open python file...
      </label>

      <button
        onClick={onAnalyzeCode}
        disabled={!hasCode || isAnalyzing}
        className="bg-primary hover:bg-green-400 text-zinc-950 disabled:bg-zinc-700 disabled:text-zinc-400 disabled:cursor-not-allowed px-5 py-2 rounded-lg transition-colors text-sm font-semibold flex items-center gap-2"
      >
        {isAnalyzing && (
          <span className="w-3.5 h-3.5 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin" aria-hidden />
        )}
        {isAnalyzing ? 'Analyzing...' : 'Analyze code'}
      </button>
    </div>
  );
}
