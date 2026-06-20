import { EvidenceItem } from '@/lib/types'

interface Props {
  readonly evidence: EvidenceItem[]
}

export default function EvidenceTrail({ evidence }: Props) {
  if (evidence.length === 0) {
    return <p className="text-xs text-slate-400 italic">No tool calls recorded.</p>
  }

  return (
    <div className="space-y-2 mt-1">
      {evidence.map((item, i) => (
        <div key={`${item.tool}-${i}`} className="border border-slate-200 rounded overflow-hidden font-mono text-xs shadow-sm">
          <div className="bg-slate-100 px-3 py-1.5 text-sky-700 font-semibold border-b border-slate-200">
            {item.tool}
          </div>
          <div className="bg-white px-3 py-2">
            <p className="text-slate-400 mb-1 font-sans text-xs">Input:</p>
            <pre className="text-slate-700 overflow-x-auto whitespace-pre-wrap break-all text-[10px]">
              {JSON.stringify(item.input, null, 2)}
            </pre>
          </div>
          <div className="bg-slate-50 px-3 py-2 border-t border-slate-200">
            <p className="text-slate-400 mb-1 font-sans text-xs">Result:</p>
            <pre className="text-emerald-700 overflow-x-auto whitespace-pre-wrap break-all text-[10px]">
              {JSON.stringify(item.result, null, 2)}
            </pre>
          </div>
        </div>
      ))}
    </div>
  )
}
