import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bot, Loader2, MessageSquare, PanelRightClose, Send, Sparkles, X } from 'lucide-react';
import { assistantApi } from '../../api/assistant';
import { useStudy } from '../../hooks/useStudy';
import ChatMessage from './ChatMessage';

const STARTERS = [
  'Compare Grade 3+ adverse events by arm',
  'What were the most common adverse events in each arm?',
  'Show patients with ALT greater than 3x ULN',
  'Do CHEMO patients show more neutropenia?',
  'Find a patient with an immune-related adverse event',
];

function pageName(pathname) {
  if (pathname.includes('safety')) return 'safety';
  if (pathname.includes('patient')) return 'patient-journey';
  if (pathname.includes('data')) return 'data-management';
  return 'study-overview';
}

export default function AssistantPanel() {
  const { selectedStudyId } = useStudy();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const page = useMemo(() => pageName(location.pathname), [location.pathname]);

  async function submitQuestion(questionText) {
    const question = questionText.trim();
    if (!question || loading || !selectedStudyId) return;

    setError(null);
    setInput('');
    const userMessage = { role: 'user', content: question };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const conversation = nextMessages
        .slice(-8)
        .map((message) => ({ role: message.role, content: message.content }));
      const response = await assistantApi.chat({
        studyId: selectedStudyId,
        page,
        question,
        conversation,
      });
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: response.answer,
          queryPlan: response.query_plan,
          display: response.display,
          sources: response.sources,
          mode: response.mode,
        },
      ]);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Assistant request failed.');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    submitQuestion(input);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        <MessageSquare className="w-4 h-4" />
        AI Assistant
      </button>
    );
  }

  return (
    <aside className="fixed right-0 top-0 z-50 flex h-screen w-[420px] max-w-[calc(100vw-16px)] flex-col border-l border-gray-200 bg-gray-50 shadow-2xl">
      <div className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">Clinical AI Assistant</div>
            <div className="text-xs text-gray-500">FHIR-guided study analysis</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            title="Collapse assistant"
          >
            <PanelRightClose className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setMessages([])}
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            title="Clear conversation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
              Answers are generated from synthetic demo data and are not medical advice.
            </div>
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <Sparkles className="h-3.5 w-3.5" />
                Starter questions
              </div>
              <div className="space-y-2">
                {STARTERS.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => submitQuestion(starter)}
                    disabled={!selectedStudyId || loading}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-700 shadow-sm hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <ChatMessage key={index} message={message} />
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing FHIR-backed study data...
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-gray-200 bg-white p-4">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={!selectedStudyId || loading}
            placeholder={selectedStudyId ? 'Ask about this trial...' : 'Select a study first'}
            className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
          />
          <button
            type="submit"
            disabled={!input.trim() || !selectedStudyId || loading}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            title="Send"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </aside>
  );
}
