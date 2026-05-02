import { Bot, User } from 'lucide-react';
import QueryPlan from './QueryPlan';
import ResultTable from './ResultTable';
import ResultChart from './ResultChart';

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user';
  const Icon = isUser ? User : Bot;

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
