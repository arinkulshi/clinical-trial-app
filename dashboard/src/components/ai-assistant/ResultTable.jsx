export default function ResultTable({ display }) {
  const columns = display?.columns || [];
  const rows = display?.rows || [];

  if (!columns.length || !rows.length) return null;

  return (
    <div className="w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      {display.title && (
        <div className="border-b border-gray-100 px-3 py-2 text-xs font-semibold text-gray-700">
          {display.title}
        </div>
      )}
      <div className="max-h-64 overflow-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="sticky top-0 bg-gray-50 text-gray-500">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-3 py-2 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="text-gray-700">
                {row.map((cell, cellIndex) => (
                  <td key={`${rowIndex}-${cellIndex}`} className="px-3 py-2">
                    {cell ?? '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
