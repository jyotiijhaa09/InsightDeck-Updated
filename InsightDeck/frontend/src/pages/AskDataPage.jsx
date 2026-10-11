import React, { useState, useRef, useEffect } from 'react';
import { sendMessageToChatbot } from '../services/api';

export default function AskDataPage({ dataset, onNavigateToUpload }) {
  const [messages, setMessages] = useState([
    {
      id: 'msg-init',
      sender: 'assistant',
      text: dataset
        ? `Hello! I have loaded **${dataset.filename}** (${dataset.details?.row_count?.toLocaleString()} records, ${dataset.details?.column_count} columns). I can answer questions about record counts, missing values, duplicates, metric totals, averages, and auditor priorities.`
        : 'Hello! Welcome to InsightDeck "Ask Your Data". Please upload an Excel workbook in the Upload tab to start querying dataset metrics and audit findings.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (textToSend) => {
    const query = (textToSend || inputValue).trim();
    if (!query) return;

    setErrorMessage('');
    const userMsg = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    try {
      const response = await sendMessageToChatbot(query);
      const assistantMsg = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: response.answer || 'No response data received.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error('Chatbot API error:', err);
      const fallbackMsg = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: err.message.includes('404')
          ? 'Please upload and analyze an Excel file first so I can answer questions about your data.'
          : 'Unable to process your question. Please check backend connection and try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
      };
      setMessages((prev) => [...prev, fallbackMsg]);
      setErrorMessage(err.message || 'Failed to communicate with chatbot.');
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: `msg-reset-${Date.now()}`,
        sender: 'assistant',
        text: dataset
          ? `Chat history cleared. Active dataset: **${dataset.filename}**. Ask me any question below!`
          : 'Chat history cleared. Please upload an Excel workbook to begin querying.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setErrorMessage('');
  };

  const samplePrompts = [
    'Summarize my data',
    'Show key insights',
    'Which columns have missing values?',
    'What should I investigate?',
    'What is the total number of records?',
    'Which numeric column has the highest average?',
  ];

  return (
    <div className="page-container ask-data-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Ask Your Data</h1>
          <p className="page-subtitle">
            {dataset
              ? `Natural language data querying for ${dataset.filename} (Deterministic analysis engine)`
              : 'Deterministic conversational analysis engine for Excel audits.'}
          </p>
        </div>

        <div className="header-actions">
          <button className="secondary-editor-btn clear-chat-btn" onClick={handleClearChat}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
            Clear Chat
          </button>
        </div>
      </div>

      <div className="chat-container card-panel">
        {/* Chat Messages Feed */}
        <div className="chat-messages-area">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`chat-bubble-wrapper ${
                msg.sender === 'user' ? 'user-msg-wrapper' : 'assistant-msg-wrapper'
              }`}
            >
              <div className="message-avatar">
                {msg.sender === 'user' ? (
                  <span>JD</span>
                ) : (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
                    <rect width="18" height="12" x="3" y="8" rx="2" />
                    <path d="M9 13v2" />
                    <path d="M15 13v2" />
                  </svg>
                )}
              </div>
              <div className={`message-bubble ${msg.isError ? 'bubble-error' : ''}`}>
                <div className="message-sender-name">
                  {msg.sender === 'user' ? 'You' : 'InsightDeck Analyst'}
                  <span className="message-time">{msg.timestamp}</span>
                </div>
                <div className="message-body formatted-markdown">
                  {msg.text.split('\n').map((paragraph, pIdx) => {
                    if (!paragraph.trim()) return <div key={pIdx} className="msg-spacer" />;
                    return (
                      <p key={pIdx} className="msg-para">
                        {paragraph}
                      </p>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="chat-bubble-wrapper assistant-msg-wrapper">
              <div className="message-avatar">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
                  <rect width="18" height="12" x="3" y="8" rx="2" />
                </svg>
              </div>
              <div className="message-bubble typing-bubble">
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts Bar */}
        <div className="quick-prompts-bar">
          <span className="quick-prompts-label">Suggested Queries:</span>
          <div className="prompt-chips">
            {samplePrompts.map((prompt, i) => (
              <button
                key={i}
                className="prompt-chip"
                onClick={() => handleSend(prompt)}
                disabled={isTyping}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Chat Input Box */}
        <form
          className="chat-input-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <textarea
            ref={textareaRef}
            className="chat-input-field chat-textarea"
            rows={1}
            placeholder={
              dataset
                ? `Ask anything about ${dataset.filename} (Enter to send, Shift+Enter for new line)...`
                : 'Upload a file first to ask questions about your data...'
            }
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            type="submit"
            className="primary-btn chat-send-btn"
            disabled={!inputValue.trim() || isTyping}
          >
            {isTyping ? (
              <span className="btn-spinner"></span>
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                Send
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
