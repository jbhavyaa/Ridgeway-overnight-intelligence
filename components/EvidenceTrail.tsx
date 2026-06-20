import { EvidenceItem } from '@/lib/types'

interface Props {
  evidence: EvidenceItem[]
}

export default function EvidenceTrail({ evidence }: Props) {
  if (evidence.length === 0) {
    return <p className="text-xs text-gray-500 italic">No tool calls recorded.</p>
  }

  return (
    <div className="space-y-2 mt-1">
      {evidence.map((item, i) => (
        <div key={i} className="border border-gray-700 rounded overflow-hidden font-mono text-xs">
          <div className="bg-gray-800 px-3 py-1.5 text-cyan-400 font-semibold border-b border-gray-700">
            {item.tool}
          </div>
          <div className="bg-gray-900 px-3 py-2">
            <p className="text-gray-500 mb-1 font-sans">Input:</p>
            <pre className="text-gray-300 overflow-x-auto whitespace-pre-wrap break-all text-[10px]">
              {JSON.stringify(item.input, null, 2)}
            </pre>
          </div>
          <div className="bg-gray-950 px-3 py-2 border-t border-gray-700">
            <p className="text-gray-500 mb-1 font-sans">Result:</p>
            <pre className="text-yellow-200 overflow-x-auto whitespace-pre-wrap break-all text-[10px]">
              {JSON.stringify(item.result, null, 2)}
            </pre>
          </div>
        </div>
      ))}
    </div>
  )
}
