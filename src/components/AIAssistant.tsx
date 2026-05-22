import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, X, Loader2, TrendingUp, Package, AlertTriangle, Users, ArrowDown, Copy, Check } from 'lucide-react';
import { useLanguage } from '../services/i18n';
import { aiService, AIContext, AIChatMessage } from '../services/aiService';
import { User, Product, Sale, Warehouse, Customer, Transfer } from '../types';
import { logger } from '../utils/logger';

interface AIAssistantProps {
  variant?: 'page' | 'widget';
  currentUser: User;
  products: Product[];
  sales: Sale[];
  warehouses: Warehouse[];
  customers: Customer[];
  transfers: Transfer[];
  onClose?: () => void;
  // Props para botón arrastrable
  buttonPosition?: { x: number; y: number };
  onButtonPositionChange?: (position: { x: number; y: number }) => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
}

const AIAssistant: React.FC<AIAssistantProps> = ({
  variant = 'widget',
  currentUser,
  products,
  sales,
  warehouses,
  customers,
  transfers,
  onClose
}) => {
  const { t, language } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Detectar si hay scroll disponible para mostrar botón "ir al final"
  const handleScroll = useCallback(() => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom && messages.length > 3);
    }
  }, [messages.length]);

  // Scroll al final
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Copiar mensaje
  const copyToClipboard = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      logger.error('Error copying to clipboard:', err);
    }
  };

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Build context
  const buildContext = (): AIContext => ({
    products,
    sales,
    warehouses,
    customers,
    transfers,
    userRole: currentUser.role
  });

  // Send message
  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || inputMessage.trim();
    if (!textToSend || isLoading) return;

    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    // Add loading indicator
    const loadingMessage: Message = {
      id: `loading-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true
    };
    setMessages(prev => [...prev, loadingMessage]);

    try {
      // Prepare conversation history
      const history: AIChatMessage[] = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      // Call AI service
      const response = await aiService.chat(
        textToSend,
        buildContext(),
        history
      );

      // Remove loading message and add AI response
      setMessages(prev => {
        const filtered = prev.filter(m => !m.isLoading);
        return [
          ...filtered,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: response.response,
            timestamp: new Date()
          }
        ];
      });

    } catch (error) {
      logger.error('AI Chat Error:', error);
      setMessages(prev => {
        const filtered = prev.filter(m => !m.isLoading);
        return [
          ...filtered,
          {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: 'Erreur lors du traitement de votre demande. Veuillez réessayer.',
            timestamp: new Date()
          }
        ];
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Quick actions
  const quickActions = aiService.getQuickActions(currentUser.role, language);

  // Handle quick action click
  const handleQuickAction = (action: string) => {
    handleSendMessage(action);
  };

  // Welcome message
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeMessages: Record<string, string> = {
        es: `¡Hola ${currentUser.name}! Soy tu asistente AI de Azmol. ¿En qué puedo ayudarte hoy?`,
        fr: `Bonjour ${currentUser.name}! Je suis votre assistant IA Azmol. Comment puis-je vous aider aujourd'hui?`,
        en: `Hello ${currentUser.name}! I'm your Azmol AI assistant. How can I help you today?`,
        ar: `مرحبا ${currentUser.name}! أنا مساعد أزمول الذكي. كيف يمكنني مساعدتك اليوم؟`
      };

      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: welcomeMessages[language] || welcomeMessages['es'],
        timestamp: new Date()
      }]);
    }
  }, []);

  // Render message
  const renderMessage = (message: Message) => {
    if (message.isLoading) {
      return (
        <div className="flex items-start gap-3 animate-pulse">
          <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 bg-slate-700 rounded-lg p-3">
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">{t('thinking')}</span>
            </div>
          </div>
        </div>
      );
    }

    const isUser = message.role === 'user';

    return (
      <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
        {/* Avatar */}
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
            isUser
              ? 'bg-gradient-accent'
              : 'bg-gradient-primary'
          }`}
        >
          {isUser ? (
            <span className="text-white text-sm font-semibold">
              {currentUser.name.charAt(0).toUpperCase()}
            </span>
          ) : (
            <Sparkles className="w-4 h-4 text-white" />
          )}
        </div>

        {/* Message bubble */}
        <div
          className={`flex-1 max-w-[80%] rounded-lg p-3 relative group ${
            isUser
              ? 'bg-blue-600 text-white'
              : 'bg-slate-700 text-slate-100'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs opacity-60">
              {message.timestamp.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
            {/* Botón copiar solo para mensajes de la IA */}
            {!isUser && (
              <button
                onClick={() => copyToClipboard(message.content, message.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-600 rounded"
                title="Copiar"
              >
                {copiedId === message.id ? (
                  <Check className="w-3 h-3 text-green-400" />
                ) : (
                  <Copy className="w-3 h-3 text-slate-400" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Widget variant (floating)
  if (variant === 'widget') {
    return (
      <div className="fixed bottom-4 right-4 w-96 h-[500px] max-h-[80vh] bg-slate-800 rounded-lg shadow-2xl border border-blue-500/30 flex flex-col z-50">
        {/* Header */}
        <div className="bg-linear-to-r from-blue-600 to-blue-700 p-4 rounded-t-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
            <h3 className="font-semibold text-white">Azmol AI</h3>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded p-1 transition"
            aria-label="Close AI Assistant"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Actions */}
        {messages.length <= 1 && (
          <div className="p-3 bg-slate-750 border-b border-slate-700">
            <p className="text-xs text-slate-400 mb-2">{t('quick_actions')}</p>
            <div className="grid grid-cols-1 gap-2">
              {quickActions.slice(0, 3).map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuickAction(action)}
                  className="text-left text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-2 rounded transition flex items-center gap-2"
                >
                  {idx === 0 && <TrendingUp className="w-3 h-3" />}
                  {idx === 1 && <Package className="w-3 h-3" />}
                  {idx === 2 && <AlertTriangle className="w-3 h-3" />}
                  <span className="truncate">{action}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 space-y-4 relative"
        >
          {messages.map(message => (
            <div key={message.id}>{renderMessage(message)}</div>
          ))}
          <div ref={messagesEndRef} />

          {/* Botón scroll al final */}
          {showScrollButton && (
            <button
              onClick={scrollToBottom}
              className="sticky bottom-2 left-1/2 -translate-x-1/2 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow-lg transition-all"
              title="Ir al final"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Input */}
        <div className="p-3 border-t border-slate-700">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={t('search_placeholder')}
              disabled={isLoading}
              className="flex-1 bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 focus:outline-none focus:border-primary-500 disabled:opacity-50"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={isLoading || !inputMessage.trim()}
              className="bg-primary-600 hover:bg-primary-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded transition"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Page variant (full screen)
  return (
    <div className="h-full bg-slate-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-gradient-primary p-6">
        <div className="flex items-center gap-3">
          <Sparkles className="w-8 h-8" />
          <div>
            <h1 className="text-2xl font-bold">Azmol AI Assistant</h1>
            <p className="text-sm text-blue-100">
              {t('welcome')}, {currentUser.name} ({currentUser.role})
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions Grid */}
      {messages.length <= 1 && (
        <div className="p-6 bg-slate-800 border-b border-slate-700">
          <h3 className="text-sm font-semibold mb-3">{t('quick_actions')}</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {quickActions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickAction(action)}
                className="bg-slate-700 hover:bg-slate-600 p-4 rounded-lg transition text-left"
              >
                <div className="flex items-center gap-2 mb-2">
                  {idx % 4 === 0 && <TrendingUp className="w-4 h-4 text-blue-400" />}
                  {idx % 4 === 1 && <Package className="w-4 h-4 text-cyan-400" />}
                  {idx % 4 === 2 && <AlertTriangle className="w-4 h-4 text-yellow-400" />}
                  {idx % 4 === 3 && <Users className="w-4 h-4 text-green-400" />}
                </div>
                <p className="text-sm">{action}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map(message => (
          <div key={message.id}>{renderMessage(message)}</div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-6 bg-slate-800 border-t border-slate-700">
        <div className="max-w-4xl mx-auto flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={t('search_placeholder')}
            disabled={isLoading}
            className="flex-1 bg-slate-700 text-white px-4 py-3 rounded-lg border border-slate-600 focus:outline-none focus:border-primary-500 disabled:opacity-50"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={isLoading || !inputMessage.trim()}
            className="bg-primary-600 hover:bg-primary-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg transition flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{t('thinking')}</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>{t('send') || 'Enviar'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
