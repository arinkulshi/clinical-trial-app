import { isValidElement } from 'react';
import { Code } from 'lucide-react';

function IconRenderer({ Icon }) {
  return <Icon className="w-5 h-5 text-blue-600" />;
}

export default function Card({ title, icon, children, className = '', onShowFhir }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
      {(title || onShowFhir) && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {icon && (isValidElement(icon) ? icon : <IconRenderer Icon={icon} />)}
            {title && <h3 className="text-sm font-semibold text-gray-800">{title}</h3>}
          </div>
          {onShowFhir && (
            <button
              onClick={onShowFhir}
              className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors"
              title="View FHIR JSON"
            >
              <Code className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}
