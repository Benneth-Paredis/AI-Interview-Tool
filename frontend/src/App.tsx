import { useState, useEffect, useRef } from 'react';
import './App.css';

const TOTAL_QUESTIONS = 8;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface SummaryData {
  summary: string;
  insights: string[];
  quotes: string[];
}

function App() {
  const [topic, setTopic] = useState('');
  const [activeTopic, setActiveTopic] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<SummaryData | 'error' | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const questionCount = messages.filter(m => m.role === 'assistant').length;
  const answerCount = messages.filter(m => m.role === 'user').length;
  const interviewDone = answerCount >= TOTAL_QUESTIONS;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Fetch summary once the user has sent their 8th answer
  useEffect(() => {
    if (!interviewDone || summary !== null) return;

    const fetchSummary = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages, topic: activeTopic }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Request failed');
        setSummary(data as SummaryData);
      } catch (err) {
        console.error('Summary error:', err);
        setSummary('error');
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewDone]);

  const startInterview = async () => {
    const trimmed = topic.trim();
    if (!trimmed) return;
    setActiveTopic(trimmed);
    setLoading(true);

    const opening = await sendToApi([], trimmed);
    if (opening) {
      setMessages([{ role: 'assistant', content: opening }]);
    }
    setLoading(false);
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading || interviewDone) return;

    const updated: Message[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(updated);
    setInput('');

    // After the 8th question, don't ask for another — the summary effect will fire
    const currentQuestionCount = updated.filter(m => m.role === 'assistant').length;
    if (currentQuestionCount >= TOTAL_QUESTIONS) return;

    setLoading(true);
    const reply = await sendToApi(updated, activeTopic);
    if (reply) {
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    }
    setLoading(false);
  };

  const sendToApi = async (msgs: Message[], t: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgs, topic: t }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Request failed');
      return data.reply as string;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${message}` }]);
      return null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') sendMessage();
  };

  // ── Setup screen ──
  if (!activeTopic) {
    return (
      <div className="setup-screen">
        <div className="setup-card">
          <h1>AI Interviewer</h1>
          <p className="setup-subtitle">Enter a topic and the AI will interview you about it.</p>
          <input
            className="setup-input"
            type="text"
            placeholder="e.g. remote work habits, morning routines…"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && startInterview()}
            autoFocus
          />
          <button className="start-btn" onClick={startInterview} disabled={!topic.trim()}>
            Start Interview
          </button>
        </div>
      </div>
    );
  }

  // ── Summary screen ──
  if (summary !== null) {
    return (
      <div className="summary-screen">
        <div className="summary-card">
          <div className="summary-header">
            <h2>Interview Summary</h2>
            <p className="summary-topic">Topic: {activeTopic}</p>
          </div>

          {summary === 'error' ? (
            <p className="summary-error">Failed to generate summary. Please try again.</p>
          ) : (
            <>
              <section className="summary-section">
                <h3>Overview</h3>
                <p className="summary-overview">{summary.summary}</p>
              </section>

              <section className="summary-section">
                <h3>Key Insights</h3>
                <ul className="insights-list">
                  {summary.insights.map((insight, i) => (
                    <li key={i}>{insight}</li>
                  ))}
                </ul>
              </section>

              <section className="summary-section">
                <h3>Notable Quotes</h3>
                <div className="quotes-list">
                  {summary.quotes.map((quote, i) => (
                    <blockquote key={i} className="quote">{quote}</blockquote>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Chat screen ──
  const inputDisabled = loading || interviewDone;

  return (
    <div className="chat-screen">
      <header className="chat-header">
        <span className="chat-topic">Topic: {activeTopic}</span>
        <span className="question-counter">
          Question {Math.min(questionCount, TOTAL_QUESTIONS)} of {TOTAL_QUESTIONS}
        </span>
      </header>

      <div className="message-list">
        {messages.map((msg, i) => (
          <div key={i} className={`bubble-row ${msg.role}`}>
            <div className={`bubble ${msg.role}`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="bubble-row assistant">
            <div className="bubble assistant loading">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-bar">
        <input
          className="chat-input"
          type="text"
          placeholder={interviewDone ? 'Interview complete…' : 'Type your answer…'}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={inputDisabled}
          autoFocus
        />
        <button className="send-btn" onClick={sendMessage} disabled={!input.trim() || inputDisabled}>
          Send
        </button>
      </div>
    </div>
  );
}

export default App;
