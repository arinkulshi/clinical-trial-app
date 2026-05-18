import { useNavigate } from 'react-router-dom';
import { ArrowRight, Bot, User } from 'lucide-react';
import QueryPlan from './QueryPlan';
import ResultTable from './ResultTable';
import ResultChart from './ResultChart';
import EvidenceCard from './EvidenceCard';

export default function ChatMessage({ message }) {
  const navigate = useNavigate();
  const isUser = message.role === 'user';
  const Icon = isUser ? User : Bot;

  function handleAction(action) {
    if (action.type === 'open_patient_journey' && action.patient_id) {
      navigate(`/patient?patient=${encodeURIComponent(action.patient_id)}`);
    }
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4" />
        </div>
      )}
      <div className={`max-w-[82%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-2`}>
        <div
          className={`rounded-lg px-3 py-2 text-sm leading-6 ${
            isUser
              ? 'bg-blue-600 text-white'
              : 'bg-white border border-gray-200 text-gray-800 shadow-sm'
          }`}
        >
          {message.content}
        </div>
        {!isUser && message.evidence && <EvidenceCard evidence={message.evidence} />}
        {!isUser && message.actions?.length > 0 && (
          <div className="flex w-full flex-wrap gap-2">
            {message.actions.map((action, index) => (
              <button
                key={`${action.type}-${action.patient_id || index}`}
                type="button"
                onClick={() => handleAction(action)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm hover:border-blue-300 hover:bg-blue-50"
              >
                {action.label || 'Open'}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        )}
        {!isUser && message.queryPlan?.length > 0 && <QueryPlan queries={message.queryPlan} />}
        {!isUser && message.display?.type === 'table' && <ResultTable display={message.display} />}
        {!isUser && ['bar', 'chart'].includes(message.display?.type) && (
          <ResultChart display={message.display} />
        )}
        {!isUser && message.sources?.length > 0 && (
          <div className="text-[11px] text-gray-500">
            Sources: {message.sources.join(', ')}
          </div>
        )}
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-800 text-white flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4" />
        </div>
      )}
    </div>
  );
}
