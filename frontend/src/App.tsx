import React, { useState, useEffect, useRef } from 'react';
import { 
  PlusIcon, 
  MicIcon, 
  ArrowUpIcon, 
  ChevronDownIcon, 
  ChatBubbleIcon, 
  XIcon, 
  CopyIcon, 
  CheckIcon, 
  RefreshIcon, 
  TrashIcon, 
  SidebarIcon,
  PaperclipIcon,
  ImageIcon,
  ThumbsUpIcon,
  ThumbsDownIcon,
  ProjectsIcon,
  ArtifactsIcon,
  CustomizeIcon,
  SearchIcon,
  ShieldIcon,
  MoreHorizontalIcon,
  SlidersIcon,
  SparkleIcon
} from './icons';
import './App.css';
import { api, getAuthHeaders, type User, type Chat, type AdminUser, type Preset } from './api';

// Types
interface Attachment {
  id: string;
  name: string;
  type: 'pdf' | 'excel' | 'image' | 'json' | 'chat-mention';
  data?: string;
}

interface ToolCall {
  name: string;
  arg: string;
  status: 'running' | 'done' | 'error';
  title?: string;
  domain?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: Attachment[];
  tool_calls?: ToolCall[];
  timestamp: string;
  isStreaming?: boolean;
  liked?: boolean;
  disliked?: boolean;
  responseTime?: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  model: string;
  timestamp: string;
}

interface ModelInfo {
  id: string;
  name: string;
  color: string;
  accentClass: string;
  description: string;
  icon: string;
}

const CLAUDE_ICON = 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Claude_AI_symbol.svg/1280px-Claude_AI_symbol.svg.png?_=20260428111349';
const OPENAI_ICON = 'https://www.svgrepo.com/show/306500/openai.svg';
const ZAI_ICON = 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/Z.ai_%28company_logo%29.svg/1280px-Z.ai_%28company_logo%29.svg.png?_=20260406011057';

const MODELS: ModelInfo[] = [
  { id: 'claude-opus-4-8', name: 'Opus 4.8', color: '#e8cfa9', accentClass: 'accent-opus-8', description: 'Most powerful, ultimate reasoning and coding.', icon: CLAUDE_ICON },
  { id: 'claude-opus-4-7', name: 'Opus 4.7', color: '#c5af8e', accentClass: 'accent-opus-7', description: 'High intelligence, creative and speed-optimized.', icon: CLAUDE_ICON },
  { id: 'claude-opus-4-6', name: 'Opus 4.6', color: '#9e8e7d', accentClass: 'accent-opus-6', description: 'Fast reasoning, excellent conversational accuracy.', icon: CLAUDE_ICON },
  { id: 'gpt-5.5', name: 'GPT 5.5', color: '#bf9a62', accentClass: 'accent-gpt-5', description: 'Multimodal powerhouse, deep analysis.', icon: OPENAI_ICON },
  { id: 'glm-5.2', name: 'GLM 5.2', color: '#ab977e', accentClass: 'accent-glm-5', description: 'GLM model for efficient reasoning and multilingual tasks.', icon: ZAI_ICON }
];

const MODEL_CREDITS: Record<string, number> = {
  'claude-opus-4-8': 2.0,
  'claude-opus-4-7': 1.5,
  'claude-opus-4-6': 1.0,
  'gpt-5.5':         1.5,
  'glm-5.2':         0.5,
};

const formatLanguageName = (lang: string): string => {
  if (!lang) return 'Code';
  const lower = lang.toLowerCase().trim();
  const wordList: Record<string, string> = {
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    python: 'Python',
    html: 'HTML',
    css: 'CSS',
    json: 'JSON',
    cpp: 'C++',
    csharp: 'C#',
    rust: 'Rust',
    bash: 'Bash',
    sql: 'SQL',
    yaml: 'YAML',
    xml: 'XML',
    markdown: 'Markdown',
    md: 'Markdown',
    dockerfile: 'Dockerfile',
    golang: 'Go',
    go: 'Go'
  };
  return wordList[lower] || lang.charAt(0).toUpperCase() + lang.slice(1);
};

interface AnimatedTitleProps {
  title?: string;
}

function AnimatedTitle({ title = '' }: AnimatedTitleProps) {
  const [displayTitle, setDisplayTitle] = useState(title);
  const [animClass, setAnimClass] = useState('');

  useEffect(() => {
    if (title !== displayTitle) {
      setAnimClass('title-exit');
      const timer = setTimeout(() => {
        setDisplayTitle(title);
        setAnimClass('title-enter');
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [title, displayTitle]);

  return (
    <span className={`thread-title text-truncate ${animClass}`}>
      {displayTitle}
    </span>
  );
}

interface ToolCallGroupProps {
  toolCalls: ToolCall[];
}

function deduplicateToolCalls(toolCalls: ToolCall[]): ToolCall[] {
  const byDomain = new Map<string, ToolCall>();
  for (const tc of toolCalls) {
    const bare = tc.arg.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const existing = byDomain.get(bare);
    if (!existing) {
      byDomain.set(bare, { ...tc, arg: bare });
    } else {
      // Merge: if either succeeded, mark as done
      if (tc.status === 'done' || existing.status === 'done') {
        const winner = tc.status === 'done' ? tc : existing;
        byDomain.set(bare, {
          ...existing,
          status: 'done',
          title: winner.title || existing.title,
          domain: winner.domain || existing.domain,
        });
      }
    }
  }
  return Array.from(byDomain.values());
}

const ToolCallGroup: React.FC<ToolCallGroupProps> = ({ toolCalls }) => {
  const [expanded, setExpanded] = useState(false);

  const merged = deduplicateToolCalls(toolCalls);
  const total = merged.length;
  const runningCount = toolCalls.filter(tc => tc.status === 'running').length;
  const errorCount = merged.filter(tc => tc.status === 'error').length;
  const doneCount = merged.filter(tc => tc.status === 'done').length;
  const isRunning = runningCount > 0;

  let headerLabel: string;
  if (isRunning) {
    headerLabel = total === 1
      ? `Fetching: ${merged[0].arg}`
      : `Fetching ${total} sources\u2026`;
  } else if (errorCount === total) {
    headerLabel = total === 1
      ? `Failed to fetch: ${merged[0].arg}`
      : `Failed to fetch ${total} sources`;
  } else if (errorCount > 0) {
    headerLabel = `Fetched ${doneCount} of ${total} sources`;
  } else {
    headerLabel = total === 1
      ? `Fetched: ${merged[0].title || merged[0].arg}`
      : `Fetched ${total} sources`;
  }

  return (
    <div className="tool-call-group">
      <div
        className="tool-call-header"
        onClick={() => { if (!isRunning) setExpanded(!expanded); }}
        style={{ cursor: isRunning ? 'default' : 'pointer' }}
      >
        <span className="tool-call-summary">{headerLabel}</span>
        {!isRunning && (
          <span className="tool-call-chevron">{expanded ? '\u25BC' : '\u203A'}</span>
        )}
      </div>

      {expanded && !isRunning && (
        <div className="tool-call-details-expanded">
          <div className="tool-call-flat-rows">
            {merged.map((tc, idx) => {
              const isTcError = tc.status === 'error';
              const tcTitle = tc.title || tc.arg;
              return (
                <React.Fragment key={idx}>
                  <div className="tool-call-flat-row">
                    <div className="tool-call-icon-container">
                      <img
                        src={`https://icons.duckduckgo.com/ip3/${tc.domain || 'google.com'}.ico`}
                        alt=""
                        className="tool-call-favicon"
                        style={{ filter: 'brightness(0) invert(1)' }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://www.google.com/s2/favicons?sz=64&domain=${tc.domain || 'google.com'}`;
                        }}
                      />
                    </div>
                    <span className="tool-call-title-text">{tcTitle}</span>
                    {tc.domain && (
                      <a
                        href={`https://${tc.arg}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="tool-call-external-link"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>{tc.domain}</span>
                        <svg className="external-link-icon" viewBox="0 0 24 24" width="11" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                      </a>
                    )}
                  </div>
                  <div className="tool-call-flat-row status-row">
                    <div className="tool-call-icon-container">
                      <div className={`tool-call-status-circle ${tc.status}`}>
                        {isTcError ? (
                          <svg className="status-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        ) : (
                          <svg className="status-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        )}
                      </div>
                    </div>
                    <span className="tool-call-status-text">
                      {isTcError ? 'Failed' : 'Done'}
                    </span>
                  </div>

                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  // Navigation & Page State
  const [activeTab, setActiveTab] = useState<'home' | 'chat' | 'all-chats' | 'customize' | 'admin'>(() => {
    return (localStorage.getItem('bloom_active_tab') as 'home' | 'chat' | 'all-chats' | 'customize' | 'admin') || 'home';
  });
  const [previousTab, setPreviousTab] = useState<string>('home');
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [recentChats, setRecentChats] = useState<ChatSession[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);

  // Auth States
  const [user, setUser] = useState<User | null>(null);
  const [authView, setAuthView] = useState<'landing' | 'login' | 'register' | 'verify'>('landing');
  const [landingScrolled, setLandingScrolled] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authVerifyCode, setAuthVerifyCode] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessMessage, setAuthSuccessMessage] = useState<string | null>(null);
  const [appInitializing, setAppInitializing] = useState(true);
  const [isReady, setIsReady] = useState(false);

  // Input states
  const [prompt, setPrompt] = useState(() => {
    return localStorage.getItem('bloom_pending_prompt') || '';
  });
  const [selectedModel, setSelectedModel] = useState<ModelInfo>(() => {
    const saved = localStorage.getItem('bloom_selected_model');
    if (saved) {
      const match = MODELS.find(m => m.id === saved);
      if (match) return match;
    }
    return MODELS[0];
  });
  const [attachments, setAttachments] = useState<Attachment[]>(() => {
    const saved = localStorage.getItem('bloom_pending_attachments');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  // Customization States
  const [customPresetId, setCustomPresetId] = useState<'default' | 'professional' | 'friendly' | 'candid' | 'quirky' | 'efficient' | 'cynical'>(() => {
    return (localStorage.getItem('bloom_custom_preset') as any) || 'default';
  });
  const [customInstructions, setCustomInstructions] = useState(() => {
    return localStorage.getItem('bloom_custom_instructions') || '';
  });
  const [customSaveStatus, setCustomSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [presets, setPresets] = useState<Preset[]>([]);
  
  // Dropdown / Modal Visibility
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [mentionState, setMentionState] = useState<{ active: boolean; query: string; triggerIndex: number; isFromPlusMenu: boolean } | null>(null);
  const [mentionSearchQuery, setMentionSearchQuery] = useState('');

  // UI States
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [voiceProgress, setVoiceProgress] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Admin States
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminActionLoading, setAdminActionLoading] = useState<string | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [activeDropdownUserId, setActiveDropdownUserId] = useState<string | null>(null);

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('bloom_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (appInitializing) return;
    if (activeSession) {
      localStorage.setItem('bloom_active_session_id', activeSession.id);
    } else {
      localStorage.removeItem('bloom_active_session_id');
    }
  }, [activeSession, appInitializing]);

  useEffect(() => {
    localStorage.setItem('bloom_pending_prompt', prompt);
  }, [prompt]);

  useEffect(() => {
    localStorage.setItem('bloom_selected_model', selectedModel.id);
  }, [selectedModel]);

  useEffect(() => {
    localStorage.setItem('bloom_pending_attachments', JSON.stringify(attachments));
  }, [attachments]);

  // Check auth session on boot & restore active session
  useEffect(() => {
    async function checkAuth() {
      try {
        const currentUser = await api.me();
        setUser(currentUser);

        // Load chats list first
        try {
          const chats = await api.listChats();
          const sessions: ChatSession[] = chats.map(c => ({
            id: c.id,
            title: c.title,
            model: c.model,
            timestamp: new Date(c.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            messages: []
          }));
          setRecentChats(sessions);
        } catch (err) {
          console.error("Failed to load chats list on boot", err);
        }

        // Load presets from backend
        try {
          const p = await api.listPresets();
          setPresets(p);
        } catch (err) {
          console.error("Failed to load presets", err);
        }

        // Restore active conversation
        const savedSessionId = localStorage.getItem('bloom_active_session_id');
        const savedTab = localStorage.getItem('bloom_active_tab');
        if (savedSessionId && savedTab === 'chat') {
          try {
            const fullChat = await api.getChat(savedSessionId);
            const mappedMessages: Message[] = fullChat.messages.map(m => ({
              id: m.id,
              role: m.role as 'user' | 'assistant',
              content: m.content,
              attachments: m.attachments,
              tool_calls: m.tool_calls,
              timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }));

            const loadedSession: ChatSession = {
              id: fullChat.id,
              title: fullChat.title,
              model: fullChat.model,
              timestamp: new Date(fullChat.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              messages: mappedMessages
            };
            setActiveSession(loadedSession);

            const modelMatch = MODELS.find(m => m.id === fullChat.model || m.name === fullChat.model);
            if (modelMatch) {
              setSelectedModel(modelMatch);
            }
          } catch (err) {
            console.error("Failed to restore active chat session", err);
            localStorage.removeItem('bloom_active_session_id');
            localStorage.setItem('bloom_active_tab', 'home');
            setActiveTab('home');
          }
        }
      } catch (err) {
        console.log("Session not found or expired on load.");
      } finally {
        setAppInitializing(false);
        setIsReady(true);
      }
    }
    checkAuth();
  }, []);

  // Fetch recent chats from backend
  const fetchChats = async () => {
    try {
      const chats = await api.listChats();
      const sessions: ChatSession[] = chats.map(c => ({
        id: c.id,
        title: c.title,
        model: c.model,
        timestamp: new Date(c.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        messages: []
      }));
      setRecentChats(sessions);

      setActiveSession(prev => {
        if (!prev) return null;
        const matchingChat = chats.find(c => c.id === prev.id);
        if (matchingChat && matchingChat.title !== prev.title) {
          return {
            ...prev,
            title: matchingChat.title
          };
        }
        return prev;
      });
    } catch (err) {
      console.error("Failed to load chats", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchChats();
    }
  }, [user]);

  // Clean selections when navigating
  useEffect(() => {
    if (activeTab !== 'all-chats') {
      setIsSelectionMode(false);
      setSelectedChatIds([]);
    }
  }, [activeTab]);

  // Admin functions
  const fetchAdminUsers = async () => {
    if (!user?.is_admin) return;
    setAdminLoading(true);
    try {
      const users = await api.adminListUsers();
      setAdminUsers(users);
    } catch (err) {
      console.error("Failed to load admin users", err);
    } finally {
      setAdminLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'admin' && user?.is_admin) {
      fetchAdminUsers();
    }
  }, [activeTab, user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleDocumentClick = () => {
      setActiveDropdownUserId(null);
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  const handleToggleAdmin = async (userId: string, currentAdmin: boolean) => {
    setAdminActionLoading(userId);
    try {
      await api.adminToggleAdmin(userId, !currentAdmin);
      setAdminUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, admin: !currentAdmin } : u
      ));
      // If we just removed our own admin, update user state
      if (userId === user?.id) {
        setUser(prev => prev ? { ...prev, is_admin: !currentAdmin } : null);
      }
    } catch (err: any) {
      alert(err.message || "Failed to toggle admin status");
    } finally {
      setAdminActionLoading(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;
    setAdminActionLoading(userId);
    try {
      await api.adminDeleteUser(userId);
      setAdminUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err: any) {
      alert(err.message || "Failed to delete user");
    } finally {
      setAdminActionLoading(null);
    }
  };

  // Greeting helper based on time of day
  const getGreeting = () => {
    const hr = new Date().getHours();
    const displayName = user ? user.email.split('@')[0] : 'Developer';
    const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);
    const name = capitalize(displayName);
    if (hr >= 5 && hr < 12) return `Good morning, ${name}`;
    if (hr >= 12 && hr < 17) return `Good afternoon, ${name}`;
    if (hr >= 17 && hr < 22) return `Good evening, ${name}`;
    return `Working late, ${name}?`;
  };

  // Auto-grow textbox on text change
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 220)}px`;
    }
  }, [prompt]);

  // Autoscroll to bottom of messages
  useEffect(() => {
    const marker = chatBottomRef.current;
    if (!marker) return;
    const raf = requestAnimationFrame(() => {
      const scroller = marker.closest('.chat-messages-container') as HTMLElement | null;
      if (scroller) {
        scroller.scrollTop = scroller.scrollHeight;
      } else {
        marker.scrollIntoView({ block: 'end' });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [
    activeSession?.messages,
    activeSession?.messages[activeSession.messages.length - 1]?.isStreaming,
    activeSession?.messages[activeSession.messages.length - 1]?.content
  ]);

  // Handle Voice simulation
  useEffect(() => {
    let interval: any;
    if (showVoiceModal && isVoiceRecording) {
      interval = setInterval(() => {
        setVoiceProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              setPrompt('Help me write a script that scrapes website data and stores it in a CSV file.');
              setShowVoiceModal(false);
              setIsVoiceRecording(false);
              setVoiceProgress(0);
            }, 800);
            return 100;
          }
          return prev + 12;
        });
      }, 300);
    }
    return () => clearInterval(interval);
  }, [showVoiceModal, isVoiceRecording]);

  // Click outside dropdowns listener
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#model-selector-home') && !target.closest('#model-selector-chat') && !target.closest('.model-dropdown')) {
        setShowModelDropdown(false);
      }
      if (!target.closest('#attach-btn-home') && !target.closest('#attach-btn-chat') && !target.closest('.attachment-dropdown')) {
        setShowAttachMenu(false);
      }
      if (!target.closest('.mention-popover-dropdown') && !target.closest('.prompt-textarea') && !target.closest('#attach-btn-home') && !target.closest('#attach-btn-chat') && !target.closest('.attachment-dropdown')) {
        setMentionState(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setPrompt(val);

    if (recentChats.length === 0) {
      return;
    }

    const selectionStart = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, selectionStart);
    
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');
    if (lastAtIdx !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIdx + 1);
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setMentionState({
          active: true,
          query: textAfterAt,
          triggerIndex: lastAtIdx,
          isFromPlusMenu: false
        });
        setMentionSearchQuery(textAfterAt);
        return;
      }
    }
    
    setMentionState(prev => prev && prev.isFromPlusMenu ? prev : null);
  };

  const handleSelectMention = (chat: any) => {
    const newMentionAttachment: Attachment = {
      id: chat.id,
      name: chat.title,
      type: 'chat-mention' as any,
    };
    
    setAttachments(prev => {
      if (prev.some(att => att.id === chat.id && att.type === 'chat-mention' as any)) {
        return prev;
      }
      return [...prev, newMentionAttachment];
    });

    if (mentionState && !mentionState.isFromPlusMenu && mentionState.triggerIndex !== -1) {
      const beforeAt = prompt.slice(0, mentionState.triggerIndex);
      const afterCursor = prompt.slice(textareaRef.current?.selectionStart || prompt.length);
      const updatedPrompt = beforeAt + afterCursor;
      setPrompt(updatedPrompt);
    }

    setMentionState(null);
    setMentionSearchQuery('');
    
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  // Customization Handlers
  const handleSaveCustomization = () => {
    setCustomSaveStatus('saving');
    localStorage.setItem('bloom_custom_preset', customPresetId);
    localStorage.setItem('bloom_custom_instructions', customInstructions);
    
    setTimeout(() => {
      setCustomSaveStatus('saved');
      setTimeout(() => {
        setCustomSaveStatus('idle');
      }, 2000);
    }, 600);
  };


  // Clear or start a new chat session
  const handleNewChat = () => {
    setActiveTab('home');
    setActiveSession(null);
    setPrompt('');
    setAttachments([]);
  };

  // Submit Prompt (Action)
  const handleSubmit = async (textToSubmit?: string, isRegenerate = false) => {
    let finalPromptText = (textToSubmit || prompt).trim();
    if (!finalPromptText && attachments.length === 0 && !isRegenerate) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: finalPromptText,
      attachments: [...attachments],
      timestamp
    };

    const assistantMsg: Message = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp,
      isStreaming: true
    };

    let sessionToUse: ChatSession;

    try {
      if (activeSession) {
        let updatedMessages: Message[];
        if (isRegenerate) {
          // If regenerate, remove the last assistant message and place streaming placeholder
          const sliced = activeSession.messages.filter(m => !m.isStreaming);
          if (sliced.length > 0 && sliced[sliced.length - 1].role === 'assistant') {
            sliced.pop(); // Remove previous assistant reply
          }
          updatedMessages = [...sliced, assistantMsg];
        } else {
          updatedMessages = [...activeSession.messages, userMsg, assistantMsg];
        }

        sessionToUse = {
          ...activeSession,
          messages: updatedMessages,
          timestamp
        };
        setActiveSession(sessionToUse);
        setActiveTab('chat');
      } else {
        const tempTitle = finalPromptText ? Array.from(finalPromptText).slice(0, 10).join('') : 'Untitled Chat';
        const newChat = await api.createChat(tempTitle, selectedModel.id);
        
        sessionToUse = {
          id: newChat.id,
          title: newChat.title,
          model: newChat.model,
          timestamp: new Date(newChat.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          messages: [userMsg, assistantMsg]
        };
        setActiveSession(sessionToUse);
        setActiveTab('chat');
        fetchChats();

        // Poll for the generated title from GLM-5.2 in the background
        let pollCount = 0;
        const maxPolls = 15;
        const intervalId = setInterval(async () => {
          pollCount++;
          if (pollCount > maxPolls) {
            clearInterval(intervalId);
            return;
          }
          try {
            const chatDetail = await api.getChat(newChat.id);
            if (chatDetail.title !== tempTitle) {
              clearInterval(intervalId);
              fetchChats();
            }
          } catch (err) {
            console.error("Failed to poll chat title", err);
          }
        }, 1000);
      }

      setPrompt('');
      setAttachments([]);

      // Deduct credits locally
      const creditCost = MODEL_CREDITS[sessionToUse.model] || 1.0;
      setUser(prev => prev ? { ...prev, credits: (prev.credits ?? 200) - creditCost } : prev);

      const startTime = Date.now();
      const response = await fetch(`/api/chats/${sessionToUse.id}/messages`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: isRegenerate ? sessionToUse.messages[sessionToUse.messages.length - 2]?.content || '' : finalPromptText,
          regenerate: isRegenerate,
          attachments: isRegenerate ? [] : attachments,
          presetId: customPresetId,
          customInstructions: customInstructions.trim() || undefined
        })
      });

      if (!response.ok) {
        let errText = 'Network error streaming completions';
        try {
          const errBody = await response.json();
          if (errBody && errBody.error) {
            errText = errBody.error;
          }
        } catch {
          // ignore
        }
        if (response.status === 402) {
          errText = 'Insufficient credits. Please wait for your credits to refresh.';
        }
        throw new Error(errText);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      if (!reader) throw new Error("Body stream reader undefined");

      let buffer = '';
      let fullAssistantText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine) continue;

          if (cleanLine.startsWith('data: ')) {
            const dataVal = cleanLine.substring(6).trim();
            if (dataVal === '[DONE]') {
              break;
            }

            try {
              const parsed = JSON.parse(dataVal);
              const delta = parsed.choices?.[0]?.delta?.content || '';
              const toolCallDelta = parsed.choices?.[0]?.delta?.tool_call;
              fullAssistantText += delta;

              setActiveSession(prev => {
                if (!prev || prev.id !== sessionToUse.id) return prev;
                return {
                  ...prev,
                  messages: prev.messages.map(m => {
                    if (m.isStreaming) {
                      const updatedToolCalls = m.tool_calls ? [...m.tool_calls] : [];
                      if (toolCallDelta) {
                        const existingIdx = updatedToolCalls.findIndex(tc => tc.arg === toolCallDelta.arg);
                        if (existingIdx >= 0) {
                          updatedToolCalls[existingIdx] = {
                            ...updatedToolCalls[existingIdx],
                            ...toolCallDelta
                          };
                        } else {
                          updatedToolCalls.push(toolCallDelta);
                        }
                      }
                      return {
                        ...m,
                        content: fullAssistantText,
                        tool_calls: updatedToolCalls
                      };
                    }
                    return m;
                  })
                };
              });
            } catch {
              // ignore JSON chunk fragments
            }
          }
        }
      }

      const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(1);

      // Finalize streaming
      setActiveSession(prev => {
        if (!prev || prev.id !== sessionToUse.id) return prev;
        return {
          ...prev,
          messages: prev.messages.map(m => 
            m.isStreaming ? { ...m, content: fullAssistantText, isStreaming: false, responseTime: `${durationSeconds}s` } : m
          )
        };
      });

      fetchChats();

    } catch (err: any) {
      console.error(err);
      setActiveSession(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages.map(m => 
            m.isStreaming ? { ...m, content: `Error: ${err.message || 'Stream processing failed'}`, isStreaming: false } : m
          )
        };
      });
    }
  };

  // Load a historic chat
  const handleLoadChat = async (session: ChatSession | Chat) => {
    try {
      const fullChat = await api.getChat(session.id);
      const mappedMessages: Message[] = fullChat.messages.map(m => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        attachments: m.attachments,
        tool_calls: m.tool_calls,
        timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }));

      const loadedSession: ChatSession = {
        id: fullChat.id,
        title: fullChat.title,
        model: fullChat.model,
        timestamp: new Date(fullChat.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        messages: mappedMessages
      };

      setActiveSession(loadedSession);
      
      const modelMatch = MODELS.find(m => m.id === fullChat.model || m.name === fullChat.model);
      if (modelMatch) {
        setSelectedModel(modelMatch);
      }
      
      setActiveTab('chat');
    } catch (err: any) {
      alert(err.message || "Failed to load chat detail");
    }
  };

  // Delete chat history
  const handleDeleteChat = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api.deleteChat(id);
      setRecentChats(prev => prev.filter(s => s.id !== id));
      if (activeSession?.id === id) {
        handleNewChat();
      }
    } catch (err: any) {
      alert(err.message || "Could not delete chat");
    }
  };

  // Toggle selection of a chat
  const handleToggleSelectChat = (id: string) => {
    setSelectedChatIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Select all chats
  const handleSelectAllChats = () => {
    const filtered = recentChats.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()));
    const filteredIds = filtered.map(s => s.id);
    const allSelected = filteredIds.every(id => selectedChatIds.includes(id));
    
    if (allSelected) {
      setSelectedChatIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedChatIds(prev => {
        const next = [...prev];
        filteredIds.forEach(id => {
          if (!next.includes(id)) next.push(id);
        });
        return next;
      });
    }
  };

  // Delete all selected chats
  const handleDeleteSelectedChats = async () => {
    try {
      await Promise.all(selectedChatIds.map(id => api.deleteChat(id)));
      setRecentChats(prev => prev.filter(s => !selectedChatIds.includes(s.id)));
      if (activeSession && selectedChatIds.includes(activeSession.id)) {
        handleNewChat();
      }
      setIsSelectionMode(false);
      setSelectedChatIds([]);
    } catch (err: any) {
      alert(err.message || "Failed to delete selected chats");
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleAttachClick = () => {
    if (selectedModel.id === 'glm-5.2') return;
    fileInputRef.current?.click();
  };

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  // Clipboard Paste Support (CTRL+V)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (selectedModel.id === 'glm-5.2') return;

      const items = e.clipboardData?.items;
      if (!items) return;

      const pastedAttachments: Attachment[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            try {
              const dataUrl = await readFileAsDataURL(file);
              const name = file.name || `pasted_image_${Date.now()}_${i}.png`;
              pastedAttachments.push({
                id: `attach-${Date.now()}-${i}`,
                name,
                type: 'image',
                data: dataUrl
              });
            } catch (err) {
              console.error("Failed to read pasted image", err);
            }
          }
        }
      }

      if (pastedAttachments.length > 0) {
        setAttachments(prev => [...prev, ...pastedAttachments]);
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [selectedModel]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    const newAttachments: Attachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        try {
          const dataUrl = await readFileAsDataURL(file);
          newAttachments.push({
            id: `attach-${Date.now()}-${i}`,
            name: file.name,
            type: 'image',
            data: dataUrl
          });
        } catch (err) {
          console.error("Failed to read file", file.name, err);
        }
      }
    }
    
    if (newAttachments.length > 0) {
      setAttachments(prev => [...prev, ...newAttachments]);
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setShowAttachMenu(false);
  };

  const handleCopyText = (text: string, id: string) => {
    const fallbackCopy = (str: string): boolean => {
      const el = document.createElement('textarea');
      el.value = str;
      el.setAttribute('readonly', '');
      el.style.position = 'absolute';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      let success = false;
      try {
        success = document.execCommand('copy');
      } catch (err) {
        console.error('Fallback copy command failed', err);
      }
      document.body.removeChild(el);
      return success;
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          setCopiedId(id);
          setTimeout(() => setCopiedId(null), 2000);
        })
        .catch((err) => {
          console.warn('Clipboard writeText failed, running fallback copy', err);
          if (fallbackCopy(text)) {
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
          }
        });
    } else {
      if (fallbackCopy(text)) {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      }
    }
  };

  // Mock message likes
  const handleLikeMessage = (messageId: string) => {
    if (!activeSession) return;
    const updatedMessages = activeSession.messages.map(m => {
      if (m.id === messageId) {
        return { ...m, liked: !m.liked, disliked: false };
      }
      return m;
    });
    setActiveSession({ ...activeSession, messages: updatedMessages });
  };

  const handleDislikeMessage = (messageId: string) => {
    if (!activeSession) return;
    const updatedMessages = activeSession.messages.map(m => {
      if (m.id === messageId) {
        return { ...m, disliked: !m.disliked, liked: false };
      }
      return m;
    });
    setActiveSession({ ...activeSession, messages: updatedMessages });
  };

  // Format markdown assistant code blocks
  const renderMessageContent = (content: string, messageId: string) => {
    // Strip out any `<fetch url="..."/>` tags from the displayed text
    const cleanContent = content.replace(/<fetch\s+url="[^"]*"\s*\/?>/gi, '');
    const parts = cleanContent.split(/(\`\`\`[a-z]*\n[\s\S]*?\`\`\`)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('```')) {
        const matches = part.match(/\`\`\`([a-z]*)\n([\s\S]*?)\`\`\`/);
        const language = matches ? matches[1] : '';
        const code = matches ? matches[2] : '';
        const codeBlockId = `${messageId}-code-${index}`;
        
        return (
          <div key={index} className="code-container">
            <div className="code-header">
              <span>{formatLanguageName(language)}</span>
              <button 
                className="code-copy-btn" 
                onClick={() => handleCopyText(code, codeBlockId)}
              >
                {copiedId === codeBlockId ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
                {copiedId === codeBlockId ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="code-block">
              <code>{code}</code>
            </pre>
          </div>
        );
      }

      const parseInlineMarkdown = (text: string): React.ReactNode[] => {
        if (!text) return [''];
        const nodes: React.ReactNode[] = [];
        // Split on bold, italic, inline code, and links — bold first to avoid * conflict
        const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(text)) !== null) {
          if (match.index > lastIndex) {
            nodes.push(text.slice(lastIndex, match.index));
          }
          const seg = match[0];
          if (seg.startsWith('**') && seg.endsWith('**')) {
            nodes.push(<strong key={`b-${match.index}`}>{seg.slice(2, -2)}</strong>);
          } else if (seg.startsWith('`') && seg.endsWith('`')) {
            nodes.push(<code key={`c-${match.index}`} className="markdown-inline-code">{seg.slice(1, -1)}</code>);
          } else if (seg.startsWith('*') && seg.endsWith('*') && !seg.startsWith('**')) {
            nodes.push(<em key={`i-${match.index}`}>{seg.slice(1, -1)}</em>);
          } else if (seg.startsWith('[') && seg.includes('](')) {
            const m = seg.match(/\[(.*?)\]\((.*?)\)/);
            if (m) {
              nodes.push(
                <a key={`a-${match.index}`} href={m[2]} target="_blank" rel="noopener noreferrer" className="markdown-link">{m[1]}</a>
              );
            } else {
              nodes.push(seg);
            }
          } else {
            nodes.push(seg);
          }
          lastIndex = regex.lastIndex;
        }
        if (lastIndex < text.length) {
          nodes.push(text.slice(lastIndex));
        }
        return nodes;
      };

      const lines = part.split('\n');
      const renderedElements: React.ReactNode[] = [];
      
      let i = 0;
      while (i < lines.length) {
        const line = lines[i];
        const cleanLine = line.trim();
        
        // Check if it's a table start (starts with | and has at least one more |)
        if (cleanLine.startsWith('|') && i + 1 < lines.length && lines[i+1].trim().startsWith('|')) {
          const tableLines: string[] = [];
          while (i < lines.length && lines[i].trim().startsWith('|')) {
            tableLines.push(lines[i].trim());
            i++;
          }
          
          if (tableLines.length >= 2) {
            const headerCells = tableLines[0]
              .split('|')
              .slice(1, -1)
              .map(cell => cell.trim());
              
            const bodyRows = tableLines.slice(2).map(rowLine => {
              return rowLine
                .split('|')
                .slice(1, -1)
                .map(cell => cell.trim());
            });
            
            renderedElements.push(
              <div key={`table-${i}`} className="table-responsive-container">
                <table className="markdown-table">
                  <thead>
                    <tr>
                      {headerCells.map((cell, cIdx) => (
                        <th key={cIdx}>{parseInlineMarkdown(cell)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bodyRows.map((rowCells, rIdx) => (
                      <tr key={rIdx}>
                        {rowCells.map((cell, cIdx) => (
                          <td key={cIdx}>{parseInlineMarkdown(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
            continue;
          }
        }
        
        const isBullet = cleanLine.startsWith('* ') || cleanLine.startsWith('- ');
        const isSeparator = /^[-*_]{3,}$/.test(cleanLine);
        let textToParse = cleanLine;
        if (isBullet) {
          textToParse = cleanLine.substring(2);
        }
        
        if (isSeparator) {
          renderedElements.push(
            <hr key={`line-${i}`} className="markdown-hr" />
          );
        } else if (isBullet) {
          renderedElements.push(
            <li key={`line-${i}`} className="markdown-li">
              {parseInlineMarkdown(textToParse)}
            </li>
          );
        } else if (cleanLine.startsWith('>')) {
          const quoteText = cleanLine.substring(1).trim();
          renderedElements.push(
            <blockquote key={`line-${i}`} className="markdown-blockquote">
              {parseInlineMarkdown(quoteText)}
            </blockquote>
          );
        } else if (cleanLine.startsWith('### ')) {
          renderedElements.push(
            <h3 key={`line-${i}`} className="markdown-h3">
              {parseInlineMarkdown(cleanLine.replace('### ', ''))}
            </h3>
          );
        } else if (cleanLine.startsWith('## ')) {
          renderedElements.push(
            <h2 key={`line-${i}`} className="markdown-h2">
              {parseInlineMarkdown(cleanLine.replace('## ', ''))}
            </h2>
          );
        } else if (cleanLine.startsWith('# ')) {
          renderedElements.push(
            <h1 key={`line-${i}`} className="markdown-h1">
              {parseInlineMarkdown(cleanLine.replace('# ', ''))}
            </h1>
          );
        } else if (cleanLine === '') {
          renderedElements.push(<div key={`line-${i}`} style={{ height: '8px' }} />);
        } else {
          renderedElements.push(
            <p key={`line-${i}`} className="markdown-p">
              {parseInlineMarkdown(line)}
            </p>
          );
        }
        
        i++;
      }

      return <div key={index} className="markdown-block">{renderedElements}</div>;
    });
  };

  // Auth Submit Handlers
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccessMessage(null);
    setAuthLoading(true);
    try {
      const res = await api.register(authEmail, authPassword);
      setAuthSuccessMessage(res.message || "A verification code has been sent!");
      setAuthView('verify');
    } catch (err: any) {
      setAuthError(err.message || "Failed to create account");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccessMessage(null);
    setAuthLoading(true);
    try {
      await api.login(authEmail, authPassword);
      const currentUser = await api.me();
      setUser(currentUser);
    } catch (err: any) {
      if (err.message.includes("not verified") || err.message.includes("email not verified")) {
        setAuthError(err.message);
        setAuthView('verify');
      } else {
        setAuthError(err.message || "Failed to log in");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccessMessage(null);
    setAuthLoading(true);
    try {
      await api.verify(authEmail, authVerifyCode);
      const currentUser = await api.me();
      setUser(currentUser);
    } catch (err: any) {
      setAuthError(err.message || "Verification code is incorrect");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
      setUser(null);
      setAuthView('landing');
      handleNewChat();
    } catch (err) {
      console.error("Logout failed", err);
      localStorage.removeItem('bloom_token');
      localStorage.removeItem('bloom_user_id');
      setUser(null);
      setAuthView('landing');
      handleNewChat();
    }
  };

  if (appInitializing) {
    return <div style={{ minHeight: '100vh', background: '#141210' }} />;
  }

  // Auth UI Route
  if (!user) {
    if (authView === 'landing') {
      return (
        <div className="lp-wrapper" onScroll={(e) => setLandingScrolled(e.currentTarget.scrollTop > window.innerHeight - 80)}>
          <header className={`lp-navbar ${landingScrolled ? 'lp-navbar-visible' : ''}`} style={{ display: 'none' }}>
            <div className="lp-container lp-navbar-inner">
              <div className="lp-nav-logo" onClick={() => setAuthView('landing')} style={{ cursor: 'pointer' }}>
                <span className="lp-nav-logo-text">Bloom</span>
              </div>
              <div className="lp-nav-actions">
                <button className="lp-nav-link" onClick={() => { setAuthView('login'); setAuthError(null); setAuthSuccessMessage(null); }}>Sign In</button>
                <button className="lp-btn-accent" onClick={() => { setAuthView('register'); setAuthError(null); setAuthSuccessMessage(null); }}>Get Started</button>
              </div>
            </div>
          </header>

          <main className="lp-main animate-fade-in">
            {/* Hero Section */}
            <section className="lp-hero-section">
              <div className="lp-container lp-hero-container">
                <h1 className="lp-hero-title">
                  Peak intelligence.<br />
                  Free. For everyone.
                </h1>
                <p className="lp-hero-subtitle">
                  A secure AI chat platform with elite models, live web search, and a credit-based usage system. Start with 200 free credits.
                </p>
                <div className="lp-hero-actions">
                  <button className="lp-btn-primary" onClick={() => { setAuthView('register'); setAuthError(null); setAuthSuccessMessage(null); }}>Get Started</button>
                  <button className="lp-btn-secondary" onClick={() => { setAuthView('login'); setAuthError(null); setAuthSuccessMessage(null); }}>Sign In</button>
                </div>
              </div>
            </section>

            {/* Models Section */}
            <section className="lp-models-section">
              <div className="lp-container">
                <div className="lp-section-header">
                  <h2 className="lp-section-title">Meet the Models</h2>
                  <p className="lp-section-subtitle">Seamlessly toggle between leading generative engines matching your needs.</p>
                </div>
                <div className="lp-models-grid">
                  {MODELS.map((model) => (
                    <div className="lp-model-card" key={model.id} style={{ '--hover-color': model.color } as React.CSSProperties}>
                      <div className="lp-model-card-header">
                        <img src={model.icon} alt={model.name} className="lp-model-icon" style={model.id === 'gpt-5.5' ? { filter: 'brightness(0) invert(1)' } : undefined} onError={(e) => {
                          (e.target as HTMLImageElement).style.opacity = '0';
                        }} />
                        <h3 className="lp-model-name">{model.name}</h3>
                      </div>
                      <p className="lp-model-desc">{model.description}</p>
                      <div className="lp-model-credit-cost">{MODEL_CREDITS[model.id]}x credits</div>
                      <div className="lp-model-accent-bar" style={{ backgroundColor: model.color }}></div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Features Section */}
            <section className="lp-features-section">
              <div className="lp-container">
                <div className="lp-section-header">
                  <h2 className="lp-section-title">Built with Intent. Focused on Utility.</h2>
                  <p className="lp-section-subtitle">No bloat. No forced telemetry. Just pure performance and privacy.</p>
                </div>
                <div className="lp-features-grid">
                  <div className="lp-feature-card">
                    <div className="lp-feature-icon">
                      <SparkleIcon size={20} />
                    </div>
                    <h3 className="lp-feature-title">Multi-Model Framework</h3>
                    <p className="lp-feature-desc">Switch instantly between Claude Opus (4.6, 4.7, 4.8), GPT 5.5, and GLM 5.2. Tailor your model to the specific complexity of your prompt.</p>
                  </div>

                  <div className="lp-feature-card">
                    <div className="lp-feature-icon">
                      <SearchIcon size={20} />
                    </div>
                    <h3 className="lp-feature-title">Agentic Web Browsing</h3>
                    <p className="lp-feature-desc">Equipped with automated, recursive web-fetching capabilities to retrieve live data and analyze articles, API documentation, or code repositories.</p>
                  </div>

                  <div className="lp-feature-card">
                    <div className="lp-feature-icon">
                      <ShieldIcon size={20} />
                    </div>
                    <h3 className="lp-feature-title">Comprehensive Privacy</h3>
                    <p className="lp-feature-desc">Your conversations are securely protected with robust authorization, secure data channels, and complete session sandboxing.</p>
                  </div>

                  <div className="lp-feature-card">
                    <div className="lp-feature-icon">
                      <SlidersIcon size={20} />
                    </div>
                    <h3 className="lp-feature-title">Creative Presets</h3>
                    <p className="lp-feature-desc">7 default response-style personas (Default, Friendly, Candid, Quirky, etc.) combined with customizable system instructions to shape output formatting.</p>
                  </div>

                  <div className="lp-feature-card">
                    <div className="lp-feature-icon">
                      <ImageIcon size={20} />
                    </div>
                    <h3 className="lp-feature-title">Multimodal Inputs</h3>
                    <p className="lp-feature-desc">Paste screenshots directly from your clipboard or upload visual documents. Get deep reasoning on images and graphics instantly.</p>
                  </div>

                  <div className="lp-feature-card">
                    <div className="lp-feature-icon">
                      <ProjectsIcon size={20} />
                    </div>
                    <h3 className="lp-feature-title">Credit-Based Usage</h3>
                    <p className="lp-feature-desc">Start with 200 free credits. Each model costs a different multiplier per prompt — cheaper models stretch your credits further.</p>
                  </div>
                </div>
              </div>
            </section>

            {/* CTA Section */}
            <section className="lp-cta-section">
              <div className="lp-container">
                <div className="lp-cta-card">
                  <h2 className="lp-cta-title">Ready to experience peak intelligence?</h2>
                  <p className="lp-cta-desc">Create an account in seconds to start chatting with Claude, GPT, and GLM. 200 free credits included.</p>
                  <div className="lp-cta-buttons">
                    <button className="lp-btn-primary lp-btn-large" onClick={() => { setAuthView('register'); setAuthError(null); setAuthSuccessMessage(null); }}>Create Account</button>
                    <button className="lp-btn-secondary lp-btn-large" onClick={() => { setAuthView('login'); setAuthError(null); setAuthSuccessMessage(null); }}>Sign In</button>
                  </div>
                </div>
              </div>
            </section>
          </main>

          <footer className="lp-footer">
            <div className="lp-container lp-footer-inner">
              <div className="lp-footer-left">
                <span className="lp-footer-brand">Bloom</span>
                <span className="lp-footer-copyright">© {new Date().getFullYear()} Bloom. Peak intelligence for everyone.</span>
              </div>
              <div className="lp-footer-right">
                <span className="lp-footer-link">FAQ</span>
                <span className="lp-footer-dot">•</span>
                <span className="lp-footer-link">Terms of Service</span>
                <span className="lp-footer-dot">•</span>
                <span className="lp-footer-link">Privacy Policy</span>
              </div>
            </div>
          </footer>
        </div>
      );
    }

    return (
      <div className="auth-container animate-fade-in">
        <div className="auth-brand-header" style={{ cursor: 'pointer' }} onClick={() => { setAuthView('landing'); setAuthError(null); setAuthSuccessMessage(null); }}>
          <span className="auth-brand-text">← Back</span>
        </div>
        <div className="auth-card">
          <div className="auth-header">
            <h1 className="auth-title">{authView === 'login' ? 'Welcome to Bloom' : authView === 'register' ? 'Create your account' : 'Verify your email'}</h1>
            <p className="auth-subtitle">Peak intelligence. Free. For everyone.</p>
          </div>
          
          {authError && <div className="auth-alert error">{authError}</div>}
          {authSuccessMessage && <div className="auth-alert success">{authSuccessMessage}</div>}

          {authView === 'login' && (
            <form onSubmit={handleLoginSubmit} className="auth-form">
              <div className="input-group">
                <label>Email</label>
                <input 
                  type="email" 
                  value={authEmail} 
                  onChange={(e) => setAuthEmail(e.target.value)} 
                  required 
                  placeholder="Your email address"
                />
              </div>
              <div className="input-group">
                <label>Password</label>
                <input 
                  type="password" 
                  value={authPassword} 
                  onChange={(e) => setAuthPassword(e.target.value)} 
                  required 
                  placeholder="Your password"
                />
              </div>
              <button type="submit" className="auth-submit" disabled={authLoading}>
                {authLoading ? 'Signing In...' : 'Continue'}
              </button>
              <p className="auth-toggle-link">
                Don't have an account? <button type="button" onClick={() => { setAuthView('register'); setAuthError(null); setAuthSuccessMessage(null); }}>Sign up</button>
              </p>
            </form>
          )}

          {authView === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="auth-form">
              <div className="input-group">
                <label>Email</label>
                <input 
                  type="email" 
                  value={authEmail} 
                  onChange={(e) => setAuthEmail(e.target.value)} 
                  required 
                  placeholder="Your email address"
                />
              </div>
              <div className="input-group">
                <label>Password</label>
                <input 
                  type="password" 
                  value={authPassword} 
                  onChange={(e) => setAuthPassword(e.target.value)} 
                  required 
                  placeholder="Minimum 8 characters"
                  minLength={8}
                />
              </div>
              <button type="submit" className="auth-submit" disabled={authLoading}>
                {authLoading ? 'Creating Account...' : 'Continue'}
              </button>
              <p className="auth-toggle-link">
                Already have an account? <button type="button" onClick={() => { setAuthView('login'); setAuthError(null); setAuthSuccessMessage(null); }}>Sign in</button>
              </p>
            </form>
          )}

          {authView === 'verify' && (
            <form onSubmit={handleVerifySubmit} className="auth-form">
              <p className="verify-instructions">
                Enter the 6-digit verification code we sent to <strong style={{ color: '#f7efe2' }}>{authEmail}</strong>.
              </p>
              <div className="input-group">
                <label>Verification Code</label>
                <input 
                  type="text" 
                  value={authVerifyCode} 
                  onChange={(e) => setAuthVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))} 
                  required 
                  placeholder="123456"
                  maxLength={6}
                  pattern="\d{6}"
                  style={{ textAlign: 'center', letterSpacing: '8px', fontSize: '20px', fontWeight: 'bold' }}
                />
              </div>
              <button type="submit" className="auth-submit" disabled={authLoading}>
                {authLoading ? 'Verifying...' : 'Verify Code'}
              </button>
              <div className="verify-actions">
                <button type="button" className="btn-resend" onClick={handleRegisterSubmit} disabled={authLoading}>
                  Resend Code
                </button>
                <span className="verify-separator">|</span>
                <button type="button" className="btn-change-view" onClick={() => { setAuthView('register'); setAuthError(null); setAuthSuccessMessage(null); }}>
                  Back to Sign Up
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="auth-footer-links">
          <span>Terms of Service</span>
          <span className="auth-footer-dot">•</span>
          <span>Privacy Policy</span>
        </div>
      </div>
    );
  }

  // App UI Route
  return (
    <div className={`app-container ${sidebarOpen ? 'sidebar-expanded' : ''} ${isReady ? 'is-ready' : ''}`}>
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        multiple 
        style={{ display: 'none' }} 
      />
      {/* Sidebar Panel */}
      <div className="app-sidebar">
        <div className="sidebar-header">
          <span className="sidebar-title">Bloom</span>
          <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)} title="Close history">
            <SidebarIcon />
          </button>
        </div>
        
        <div className="sidebar-nav-group">
          <button className="sidebar-nav-item new-chat-btn" onClick={handleNewChat}>
            <PlusIcon size={16} />
            <span>New chat</span>
          </button>
          
          <button className="sidebar-nav-item disabled-nav-item" disabled>
            <ProjectsIcon size={16} />
            <span>Projects</span>
          </button>
          
          <button className="sidebar-nav-item disabled-nav-item" disabled>
            <ArtifactsIcon size={16} />
            <span>Artifacts</span>
          </button>
          
          <button 
            className={`sidebar-nav-item ${activeTab === 'customize' ? 'active' : ''}`} 
            onClick={() => {
              setActiveTab('customize');
            }}
          >
            <CustomizeIcon size={16} />
            <span>Customize</span>
          </button>

          {user?.is_admin && (
            <button 
              className={`sidebar-nav-item ${activeTab === 'admin' ? 'active' : ''}`} 
              onClick={() => {
                setActiveTab('admin');
              }}
            >
              <ShieldIcon size={16} />
              <span>Admin</span>
            </button>
          )}
        </div>

        {recentChats.length > 0 ? (
          <>
            <div className="sidebar-section-header">
              <span className="sidebar-section-title">Recent Chats</span>
              <button 
                className="sidebar-view-all-btn"
                onClick={() => {
                  setActiveTab('all-chats');
                  setSidebarOpen(false);
                }}
              >
                View all &rsaquo;
              </button>
            </div>
            <div className="sidebar-history-list">
              {recentChats.slice(0, 5).map((session) => (
                <div 
                  key={session.id} 
                  className={`sidebar-history-item ${activeSession?.id === session.id ? 'active' : ''}`}
                  onClick={() => handleLoadChat(session)}
                >
                  <div className="history-item-content">
                    <span className="history-text text-truncate">{session.title}</span>
                  </div>
                  <button 
                    className="history-delete-btn"
                    onClick={(e) => handleDeleteChat(e, session.id)}
                    title="Delete chat"
                  >
                    <TrashIcon size={12} />
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="sidebar-section-title">No recent chats</div>
        )}

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <div className="profile-badge-row">
            <div className="profile-details">
              <div className="profile-left">
                <div className="profile-avatar-circle">
                  {user.email.split('@')[0].charAt(0).toUpperCase()}
                </div>
                <div className="profile-info">
                  <span className="profile-name text-truncate" title={user.email}>
                    {user.email.split('@')[0].charAt(0).toUpperCase() + user.email.split('@')[0].slice(1)}
                  </span>
                  <span className="profile-plan">{user.credits ?? 200} credits</span>
                </div>
              </div>
              <button onClick={handleLogout} className="logout-btn-link" title="Sign out">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="app-main-content">


        {/* Voice Recorder Overlay Modal */}
        {showVoiceModal && (
          <div 
            className="modal-backdrop voice-backdrop animate-fade-in" 
            id="voice-recording-dialog"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowVoiceModal(false);
                setIsVoiceRecording(false);
              }
            }}
          >
            <div className="voice-content animate-slide-up">
              <div className="voice-logo-wrapper">
                <div className="voice-mic-wave-pulse"></div>
                <div className="voice-mic-ring">
                  <MicIcon className="voice-mic-icon" />
                </div>
              </div>
              
              <h3 className="voice-status">
                {voiceProgress < 30 ? 'Connecting microphone...' : 
                 voiceProgress < 75 ? 'Listening closely...' : 
                 voiceProgress < 100 ? 'Synthesizing voice audio...' : 'Done transcription!'}
              </h3>
              
              <p className="voice-caption">
                {voiceProgress < 30 ? 'Please speak now' : 
                 voiceProgress < 75 ? '"Help me write a script that..."' : 'Adding to input box...'}
              </p>

              <div className="voice-waveforms">
                <div className="waveform-bar bar-1"></div>
                <div className="waveform-bar bar-2"></div>
                <div className="waveform-bar bar-3"></div>
                <div className="waveform-bar bar-4"></div>
                <div className="waveform-bar bar-5"></div>
                <div className="waveform-bar bar-6"></div>
                <div className="waveform-bar bar-5"></div>
                <div className="waveform-bar bar-4"></div>
                <div className="waveform-bar bar-3"></div>
                <div className="waveform-bar bar-2"></div>
                <div className="waveform-bar bar-1"></div>
              </div>

              <div className="progress-container">
                <div className="progress-bar" style={{ width: `${voiceProgress}%` }}></div>
              </div>

              <button className="btn-voice-cancel" onClick={() => {
                setShowVoiceModal(false);
                setIsVoiceRecording(false);
              }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* MAIN VIEWS */}
        {activeTab === 'home' ? (
          // ================= HOME / LANDING SCREEN =================
          <div className="home-screen animate-fade-in">
            <div className="home-top-controls">
              <div className="top-controls-left">
                <button 
                  className="sidebar-toggle-btn" 
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  title="Toggle History"
                  id="sidebar-toggle-home"
                >
                  <SidebarIcon />
                </button>
                {user?.is_admin && (
                  <button 
                    className="sidebar-toggle-btn admin-shield-btn" 
                    onClick={() => {
                      setPreviousTab(activeTab);
                      setActiveTab('admin');
                    }}
                    title="Admin Panel"
                  >
                    <ShieldIcon />
                  </button>
                )}
              </div>
              <div className="top-controls-right">
                <div className="credits-badge" title={`${user?.credits ?? 200} credits — resets daily at midnight UTC`}>
                  <span className="credits-amount">{user?.credits ?? 200}/200</span>
                </div>
              </div>
            </div>

            <div className="home-content">
              <div className="logo-section greeting-container">
                <h1 className="greeting-text">{getGreeting()}</h1>
              </div>

              <div className="prompt-container-box">
                {attachments.length > 0 && (
                  <div className="attachment-chips-row">
                    {attachments.map((file) => {
                      if (file.type === 'image' && file.data) {
                        return (
                          <div key={file.id} className="attachment-preview-square">
                            <img src={file.data} alt={file.name} className="attachment-preview-img" />
                            <button className="preview-remove-btn" onClick={() => handleRemoveAttachment(file.id)} title="Remove image">
                              <XIcon size={10} />
                            </button>
                          </div>
                        );
                      }
                      if (file.type === 'chat-mention' as any) {
                        return (
                          <div key={file.id} className="attachment-chip mention-chip">
                            <span className="chip-icon"><ChatBubbleIcon size={14} /></span>
                            <span className="chip-name">{file.name}</span>
                            <button className="chip-remove" onClick={() => handleRemoveAttachment(file.id)}>
                              <XIcon size={12} />
                            </button>
                          </div>
                        );
                      }
                      return (
                        <div key={file.id} className="attachment-chip">
                          <span className="chip-icon">
                            {file.type === 'pdf' ? '📄' : file.type === 'excel' ? '📊' : file.type === 'image' ? '🖼️' : '📝'}
                          </span>
                          <span className="chip-name">{file.name}</span>
                          <button className="chip-remove" onClick={() => handleRemoveAttachment(file.id)}>
                            <XIcon size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={handleTextareaChange}
                  placeholder="How can I help you today?"
                  className="prompt-textarea"
                  rows={1}
                  id="prompt-input-home"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                />

                <div className="prompt-toolbar-row">
                  <div className="toolbar-left-tools">
                    <div className="relative-popover-container">
                      <button 
                        className="toolbar-btn text-icon" 
                        title="Attach file context"
                        onClick={() => {
                          setShowAttachMenu(!showAttachMenu);
                          setShowModelDropdown(false);
                        }}
                        id="attach-btn-home"
                      >
                        <PlusIcon />
                      </button>

                      {showAttachMenu && (
                        <div className="popover-dropdown attachment-dropdown">
                          <button 
                            className={`popover-item ${selectedModel.id === 'glm-5.2' ? 'disabled' : ''}`} 
                            onClick={handleAttachClick}
                            disabled={selectedModel.id === 'glm-5.2'}
                            title={selectedModel.id === 'glm-5.2' ? "Attachments not supported by GLM 5.2" : "Add attachments"}
                          >
                            <PaperclipIcon size={14} />
                            <span>Add attachments</span>
                          </button>
                          <button 
                            className={`popover-item ${recentChats.length === 0 ? 'disabled' : ''}`}
                            disabled={recentChats.length === 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              setMentionState({
                                active: true,
                                query: '',
                                triggerIndex: -1,
                                isFromPlusMenu: true
                              });
                              setMentionSearchQuery('');
                              setShowAttachMenu(false);
                            }}
                          >
                            <ChatBubbleIcon size={14} />
                            <span>Mention chats</span>
                          </button>
                          <button className="popover-item disabled" disabled>
                            <ImageIcon size={14} />
                            <span>Create image</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="toolbar-right-tools">
                    <div className="relative-popover-container">
                      <button 
                        className={`model-select-pill ${showModelDropdown ? 'open' : ''}`}
                        style={{ '--model-accent': selectedModel.color } as React.CSSProperties}
                        onClick={() => {
                          setShowModelDropdown(!showModelDropdown);
                          setShowAttachMenu(false);
                        }}
                        id="model-selector-home"
                      >
                        <img src={selectedModel.icon} alt="" style={{ width: 14, height: 14, filter: selectedModel.icon === ZAI_ICON ? 'invert(1) brightness(2)' : 'brightness(0) invert(1)', verticalAlign: 'middle' }} />
                        <span>{selectedModel.name}</span>
                        <ChevronDownIcon className="model-arrow" />
                      </button>

                      {showModelDropdown && (
                        <div className="popover-dropdown model-dropdown">
                          {MODELS.map((model) => (
                            <button 
                              key={model.id} 
                              className={`model-dropdown-item ${selectedModel.id === model.id ? 'active' : ''}`}
                              onClick={() => {
                                setSelectedModel(model);
                                setShowModelDropdown(false);
                              }}
                            >
                              <img src={model.icon} alt="" style={{ width: 14, height: 14, filter: model.icon === ZAI_ICON ? 'invert(1) brightness(2)' : 'brightness(0) invert(1)' }} />
                              <span className="model-item-name">{model.name}</span>
                              <span className="model-item-credit">{MODEL_CREDITS[model.id]}x</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button 
                      className={`submit-arrow-circle ${(prompt.trim() || attachments.length > 0) ? 'submit-active' : ''}`}
                      onClick={() => handleSubmit()}
                      disabled={!prompt.trim() && attachments.length === 0}
                      title="Send message"
                      id="submit-btn-home"
                    >
                      <ArrowUpIcon />
                    </button>
                  </div>
                </div>

                {mentionState && mentionState.active && (
                  <div className="mention-popover-dropdown">
                    <div className="mention-header">Link a chat</div>
                    <div className="mention-list">
                      {recentChats
                        .filter(chat => chat.title.toLowerCase().includes((mentionState.query || '').toLowerCase()))
                        .map((chat) => (
                          <button
                            key={chat.id}
                            className="mention-item"
                            onClick={() => handleSelectMention(chat)}
                          >
                            <ChatBubbleIcon size={14} className="mention-icon" />
                            <span className="mention-title">{chat.title}</span>
                          </button>
                        ))
                      }
                      {recentChats.filter(chat => chat.title.toLowerCase().includes((mentionState.query || '').toLowerCase())).length === 0 && (
                        <div className="mention-no-results">No chats found</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'all-chats' ? (
          // ================= CHATS DIRECTORY SCREEN =================
          <div className="chats-directory-screen animate-fade-in">
            <div className="home-top-controls">
              <div className="top-controls-left">
                <button 
                  className="sidebar-toggle-btn" 
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  title="Toggle History"
                  id="sidebar-toggle-directory"
                >
                  <SidebarIcon />
                </button>
                {user?.is_admin && (
                  <button 
                    className="sidebar-toggle-btn admin-shield-btn" 
                    onClick={() => {
                      setPreviousTab(activeTab);
                      setActiveTab('admin');
                    }}
                    title="Admin Panel"
                  >
                    <ShieldIcon />
                  </button>
                )}
              </div>
              <div className="top-controls-right">
                <div className="credits-badge" title={`${user?.credits ?? 200} credits — resets daily at midnight UTC`}>
                  <span className="credits-amount">{user?.credits ?? 200}/200</span>
                </div>
              </div>
            </div>

            <div className="directory-content">
              <div className="directory-header">
                <h2 className="directory-title">Chats</h2>
                <div className="directory-actions">
                  {isSelectionMode ? (
                    <>
                      <span className="directory-selected-count">{selectedChatIds.length} selected</span>
                      <button 
                        className="directory-action-btn" 
                        onClick={handleSelectAllChats}
                      >
                        Select all
                      </button>
                      <button className="directory-action-btn" disabled>
                        Move to project
                      </button>
                      <button 
                        className="directory-action-btn" 
                        onClick={handleDeleteSelectedChats}
                        disabled={selectedChatIds.length === 0}
                      >
                        Delete
                      </button>
                      <button 
                        className="directory-cancel-btn" 
                        onClick={() => {
                          setIsSelectionMode(false);
                          setSelectedChatIds([]);
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="directory-filter-btn">
                        <span>Filter by All</span>
                        <ChevronDownIcon size={12} />
                      </button>
                      <button 
                        className="directory-action-btn"
                        onClick={() => {
                          setIsSelectionMode(true);
                          setSelectedChatIds([]);
                        }}
                      >
                        Select chats
                      </button>
                      <button 
                        className="directory-action-btn highlight-btn" 
                        onClick={handleNewChat}
                      >
                        New chat
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="directory-search-container">
                <SearchIcon className="directory-search-icon" size={16} />
                <input 
                  type="text" 
                  placeholder="Search chats..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="directory-search-input"
                />
              </div>

              <div className="directory-list-container">
                {recentChats.length === 0 ? (
                  <div className="directory-empty-state">You have no chats yet</div>
                ) : recentChats.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 ? (
                  recentChats
                    .filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((session) => {
                      const isSelected = selectedChatIds.includes(session.id);
                      return (
                        <div 
                          key={session.id} 
                          className={`directory-row-item ${isSelected ? 'row-selected' : ''}`}
                          onClick={() => {
                            if (isSelectionMode) {
                              handleToggleSelectChat(session.id);
                            } else {
                              handleLoadChat(session);
                            }
                          }}
                        >
                          <div className="directory-row-left">
                            {isSelectionMode && (
                              <div className={`directory-checkbox ${isSelected ? 'checked' : ''}`}>
                                {isSelected && <CheckIcon size={10} strokeWidth={3} />}
                              </div>
                            )}
                            <span className="directory-item-title">{session.title}</span>
                          </div>
                          <span className="directory-item-time">{session.timestamp || 'Just now'}</span>
                        </div>
                      );
                    })
                ) : (
                  <div className="directory-empty-state">No matching chats found</div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'customize' ? (
          // ================= CUSTOMIZE SCREEN =================
          <div className="customize-screen animate-fade-in">
            <div className="home-top-controls">
              <div className="top-controls-left">
                <button 
                  className="sidebar-toggle-btn" 
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  title="Toggle History"
                  id="sidebar-toggle-customize"
                >
                  <SidebarIcon />
                </button>
                {user?.is_admin && (
                  <button 
                    className="sidebar-toggle-btn admin-shield-btn" 
                    onClick={() => {
                      setPreviousTab(activeTab);
                      setActiveTab('admin');
                    }}
                    title="Admin Panel"
                  >
                    <ShieldIcon />
                  </button>
                )}
              </div>
              <div className="top-controls-right">
                <div className="credits-badge" title={`${user?.credits ?? 200} credits — resets daily at midnight UTC`}>
                  <span className="credits-amount">{user?.credits ?? 200}/200</span>
                </div>
              </div>
            </div>

            <div className="customize-content-container">
              <div className="customize-header">
                <h1 className="customize-title">Customize Bloom</h1>
                <p className="customize-subtitle">Configure how Bloom acts, responds, and writes code across all your conversations.</p>
              </div>

              <div className="customize-section">
                <h3 className="section-title">Instructions Preset</h3>
                <p className="section-subtitle">Choose a persona that shapes how Bloom responds to you.</p>
                
                <div className="presets-grid">
                  {presets.map((preset) => {
                    const isSelected = customPresetId === preset.id;
                    return (
                      <div 
                        key={preset.id} 
                        className={`preset-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => setCustomPresetId(preset.id as any)}
                      >
                        <div className="preset-card-header">
                          <span className="preset-name">{preset.name}</span>
                          <div className={`preset-radio-circle ${isSelected ? 'checked' : ''}`}>
                            {isSelected && <div className="radio-dot" />}
                          </div>
                        </div>
                        <p className="preset-description">{preset.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="customize-section">
                <h3 className="section-title">Additional Custom Instructions</h3>
                <p className="section-subtitle">Add your own system instructions, rules, constraints, or formatting preferences.</p>
                
                <textarea
                  className="custom-instructions-textarea"
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="e.g. 'Always respond in Spanish', 'Avoid introductory small-talk', 'Address me as Captain'..."
                  rows={6}
                />
              </div>

              <div className="customize-actions-row">
                <button 
                  className="customize-save-btn"
                  onClick={handleSaveCustomization}
                  disabled={customSaveStatus === 'saving'}
                >
                  {customSaveStatus === 'saving' ? (
                    'Saving changes...'
                  ) : customSaveStatus === 'saved' ? (
                    'Saved successfully'
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : activeTab === 'admin' ? (
          // ================= ADMIN PANEL SCREEN =================
          <div className="admin-screen animate-fade-in">
            <div className="home-top-controls">
              <div className="top-controls-left">
                <button 
                  className="sidebar-toggle-btn" 
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  title="Toggle History"
                  id="sidebar-toggle-admin"
                >
                  <SidebarIcon />
                </button>
                <button 
                  className="sidebar-toggle-btn admin-shield-btn active" 
                  onClick={() => {
                    setActiveTab(previousTab as any);
                  }}
                  title="Admin Panel"
                >
                  <ShieldIcon />
                </button>
              </div>
              <div className="top-controls-right">
                <div className="credits-badge" title={`${user?.credits ?? 200} credits — resets daily at midnight UTC`}>
                  <span className="credits-amount">{user?.credits ?? 200}/200</span>
                </div>
              </div>
            </div>

            <div className="admin-content-container">
              <div className="admin-header">
                <h1 className="admin-title">Admin Panel</h1>
                <p className="admin-subtitle">Manage users and permissions. Add or remove admin privileges or delete registered accounts.</p>
              </div>

              <div className="admin-search-container">
                <SearchIcon className="admin-search-icon" size={16} />
                <input 
                  type="text" 
                  placeholder="Search users..." 
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="admin-search-input"
                />
              </div>

              <div className="admin-list-container">
                {adminLoading ? (
                  <div className="admin-loading">
                    <div className="typing-indicator">
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                    </div>
                  </div>
                ) : (
                  <>
                    {adminUsers.filter(u => u.email.toLowerCase().includes(userSearchQuery.toLowerCase())).length > 0 ? (
                      adminUsers
                        .filter(u => u.email.toLowerCase().includes(userSearchQuery.toLowerCase()))
                        .map((u) => (
                          <div key={u.id} className="admin-row-item">
                            <div className="admin-row-left">
                              <span className="admin-user-avatar">{u.email.charAt(0).toUpperCase()}</span>
                              <div className="admin-user-details">
                                <span className="admin-user-email">{u.email}</span>
                                <span className="admin-user-joined">Joined {new Date(u.created_at).toLocaleDateString()}</span>
                              </div>
                            </div>

                            <div className="admin-row-right">
                              <div className="admin-role-section">
                                {u.admin ? (
                                  <span className="admin-role-badge admin-badge">
                                    Admin
                                  </span>
                                ) : (
                                  <span className="admin-role-badge user-badge">User</span>
                                )}
                              </div>

                              <div className="admin-actions-section relative-popover-container">
                                <button 
                                  className={`admin-more-btn ${u.id === user?.id ? 'disabled' : ''} ${activeDropdownUserId === u.id ? 'active' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (u.id !== user?.id) {
                                      setActiveDropdownUserId(activeDropdownUserId === u.id ? null : u.id);
                                    }
                                  }}
                                  disabled={u.id === user?.id}
                                  title={u.id === user?.id ? "Cannot manage your own account" : "Manage account"}
                                >
                                  <MoreHorizontalIcon />
                                </button>

                                {activeDropdownUserId === u.id && (
                                  <div className="popover-dropdown admin-dropdown" onClick={(e) => e.stopPropagation()}>
                                    <button 
                                      className="popover-item"
                                      onClick={() => {
                                        handleToggleAdmin(u.id, u.admin);
                                        setActiveDropdownUserId(null);
                                      }}
                                      disabled={adminActionLoading === u.id}
                                    >
                                      <span>{u.admin ? 'Revoke Admin' : 'Make Admin'}</span>
                                    </button>
                                    <button 
                                      className="popover-item delete-item"
                                      onClick={() => {
                                        handleDeleteUser(u.id);
                                        setActiveDropdownUserId(null);
                                      }}
                                      disabled={adminActionLoading === u.id}
                                    >
                                      <span>Delete Account</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="admin-empty-state">No matching users found</div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          // ================= CHAT THREAD SCREEN =================
          <div className="chat-screen animate-fade-in">
            <div className="home-top-controls">
              <div className="chat-header-left">
                <div className="top-controls-left">
                  <button 
                    className="sidebar-toggle-btn" 
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    title="Toggle History"
                    id="sidebar-toggle-chat"
                  >
                    <SidebarIcon />
                  </button>
                  {user?.is_admin && (
                    <button 
                      className="sidebar-toggle-btn admin-shield-btn" 
                      onClick={() => {
                        setPreviousTab(activeTab);
                        setActiveTab('admin');
                      }}
                      title="Admin Panel"
                    >
                      <ShieldIcon />
                    </button>
                  )}
                </div>
                <AnimatedTitle title={activeSession?.title} />
              </div>
              <div className="top-controls-right">
                <div className="credits-badge" title={`${user?.credits ?? 200} credits — resets daily at midnight UTC`}>
                  <span className="credits-amount">{user?.credits ?? 200}/200</span>
                </div>
              </div>
            </div>

            <div className="chat-messages-container">
              <div className="chat-messages-scroll-area">
                {activeSession?.messages.map((message) => (
                  <div 
                    key={message.id} 
                    className={`message-row-wrapper ${message.role === 'user' ? 'user-wrapper' : 'assistant-wrapper'}`}
                  >
                    {message.role === 'user' ? (
                      <div className="user-message-bubble">
                        {message.attachments && message.attachments.length > 0 && (
                          <div className="message-bubble-attachments">
                            {message.attachments.map((file) => {
                              if (file.type === 'image' && file.data) {
                                  return (
                                    <div key={file.id} className="bubble-attachment-image-wrapper">
                                      <img src={file.data} alt={file.name} className="bubble-attachment-image" />
                                    </div>
                                  );
                              }
                              if (file.type === 'chat-mention' as any) {
                                return (
                                  <div key={file.id} className="bubble-attachment-card mention-card">
                                    <span className="attachment-type-icon"><ChatBubbleIcon size={14} /></span>
                                    <div className="attachment-details">
                                      <div className="attachment-title">{file.name}</div>
                                      <div className="attachment-subtitle">Mentioned chat context</div>
                                    </div>
                                  </div>
                                );
                              }
                              return (
                                <div key={file.id} className="bubble-attachment-card">
                                  <span className="attachment-type-icon">
                                    {file.type === 'pdf' ? '📄' : file.type === 'excel' ? '📊' : file.type === 'image' ? '🖼️' : '📝'}
                                  </span>
                                  <div className="attachment-details">
                                    <div className="attachment-title">{file.name}</div>
                                    <div className="attachment-subtitle">Ready as context</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <p className="user-message-text">{message.content}</p>
                      </div>
                    ) : (
                      <div className="assistant-message-bubble">
                        {message.tool_calls && message.tool_calls.length > 0 && (
                          <div className="message-tool-calls-container">
                            <ToolCallGroup toolCalls={message.tool_calls} />
                          </div>
                        )}
                        <div className="message-body-content">
                          {renderMessageContent(message.content, message.id)}
                          {message.isStreaming && !message.content.replace(/<fetch\s+url="[^"]*"\s*\/?>/gi, '').trim() && (
                            <div className="typing-cursor-pulsar">
                              <div className="dot"></div>
                              <div className="dot"></div>
                              <div className="dot"></div>
                            </div>
                          )}
                        </div>

                        {!message.isStreaming && (
                          <div className="message-actions-toolbar">
                            {message.responseTime && (
                              <span className="msg-response-time" style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: '8px', alignSelf: 'center', userSelect: 'none' }}>
                                {message.responseTime}
                              </span>
                            )}

                            <button 
                              className="msg-action-btn"
                              onClick={() => handleCopyText(message.content, message.id)}
                              title="Copy response"
                            >
                              {copiedId === message.id ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
                            </button>

                            <button 
                              className={`msg-action-btn ${message.liked ? 'liked' : ''}`} 
                              title="Thumbs up"
                              onClick={() => handleLikeMessage(message.id)}
                            >
                              <ThumbsUpIcon size={16} fill={message.liked ? 'currentColor' : 'none'} />
                            </button>

                            <button 
                              className={`msg-action-btn ${message.disliked ? 'disliked' : ''}`} 
                              title="Thumbs down"
                              onClick={() => handleDislikeMessage(message.id)}
                            >
                              <ThumbsDownIcon size={16} fill={message.disliked ? 'currentColor' : 'none'} />
                            </button>
                            
                            <button 
                              className="msg-action-btn" 
                              onClick={() => handleSubmit(undefined, true)}
                              title="Regenerate reply"
                            >
                              <RefreshIcon size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={chatBottomRef} />
              </div>
            </div>

            <div className="chat-input-sticky-footer">
              <div className="prompt-container-box sticky-width-limiter">
                {attachments.length > 0 && (
                  <div className="attachment-chips-row">
                    {attachments.map((file) => {
                      if (file.type === 'image' && file.data) {
                        return (
                          <div key={file.id} className="attachment-preview-square">
                            <img src={file.data} alt={file.name} className="attachment-preview-img" />
                            <button className="preview-remove-btn" onClick={() => handleRemoveAttachment(file.id)} title="Remove image">
                              <XIcon size={10} />
                            </button>
                          </div>
                        );
                      }
                      if (file.type === 'chat-mention' as any) {
                        return (
                          <div key={file.id} className="attachment-chip mention-chip">
                            <span className="chip-icon"><ChatBubbleIcon size={14} /></span>
                            <span className="chip-name">{file.name}</span>
                            <button className="chip-remove" onClick={() => handleRemoveAttachment(file.id)}>
                              <XIcon size={12} />
                            </button>
                          </div>
                        );
                      }
                      return (
                        <div key={file.id} className="attachment-chip">
                          <span className="chip-icon">
                            {file.type === 'pdf' ? '📄' : file.type === 'excel' ? '📊' : file.type === 'image' ? '🖼️' : '📝'}
                          </span>
                          <span className="chip-name">{file.name}</span>
                          <button className="chip-remove" onClick={() => handleRemoveAttachment(file.id)}>
                            <XIcon size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={handleTextareaChange}
                  placeholder="Ask follow-up questions..."
                  className="prompt-textarea"
                  rows={1}
                  id="prompt-input-chat"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                />

                <div className="prompt-toolbar-row">
                  <div className="toolbar-left-tools">
                    <div className="relative-popover-container">
                      <button 
                        className="toolbar-btn text-icon" 
                        title="Attach file context"
                        onClick={() => {
                          setShowAttachMenu(!showAttachMenu);
                          setShowModelDropdown(false);
                        }}
                        id="attach-btn-chat"
                      >
                        <PlusIcon />
                      </button>

                      {showAttachMenu && (
                        <div className="popover-dropdown attachment-dropdown">
                          <button 
                            className={`popover-item ${selectedModel.id === 'glm-5.2' ? 'disabled' : ''}`} 
                            onClick={handleAttachClick}
                            disabled={selectedModel.id === 'glm-5.2'}
                            title={selectedModel.id === 'glm-5.2' ? "Attachments not supported by GLM 5.2" : "Add attachments"}
                          >
                            <PaperclipIcon size={14} />
                            <span>Add attachments</span>
                          </button>
                          <button 
                            className={`popover-item ${recentChats.length === 0 ? 'disabled' : ''}`}
                            disabled={recentChats.length === 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              setMentionState({
                                active: true,
                                query: '',
                                triggerIndex: -1,
                                isFromPlusMenu: true
                              });
                              setMentionSearchQuery('');
                              setShowAttachMenu(false);
                            }}
                          >
                            <ChatBubbleIcon size={14} />
                            <span>Mention chats</span>
                          </button>
                          <button className="popover-item disabled" disabled>
                            <ImageIcon size={14} />
                            <span>Create image</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="toolbar-right-tools">
                    <div className="relative-popover-container">
                      <button 
                        className={`model-select-pill ${showModelDropdown ? 'open' : ''}`}
                        style={{ '--model-accent': selectedModel.color } as React.CSSProperties}
                        onClick={() => {
                          setShowModelDropdown(!showModelDropdown);
                          setShowAttachMenu(false);
                        }}
                        id="model-selector-chat"
                      >
                        <img src={selectedModel.icon} alt="" style={{ width: 14, height: 14, filter: selectedModel.icon === ZAI_ICON ? 'invert(1) brightness(2)' : 'brightness(0) invert(1)', verticalAlign: 'middle' }} />
                        <span>{selectedModel.name}</span>
                        <ChevronDownIcon className="model-arrow" />
                      </button>

                      {showModelDropdown && (
                        <div className="popover-dropdown model-dropdown">
                          {MODELS.map((model) => (
                            <button 
                              key={model.id} 
                              className={`model-dropdown-item ${selectedModel.id === model.id ? 'active' : ''}`}
                              onClick={() => {
                                setSelectedModel(model);
                                setShowModelDropdown(false);
                              }}
                            >
                              <img src={model.icon} alt="" style={{ width: 14, height: 14, flexShrink: 0, filter: model.icon === ZAI_ICON ? 'invert(1) brightness(2)' : 'brightness(0) invert(1)' }} />
                              <span className="model-item-name">{model.name}</span>
                              <span className="model-item-credit">{MODEL_CREDITS[model.id]}x</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button 
                      className={`submit-arrow-circle ${(prompt.trim() || attachments.length > 0) ? 'submit-active' : ''}`}
                      onClick={() => handleSubmit()}
                      disabled={!prompt.trim() && attachments.length === 0}
                      title="Send message"
                      id="submit-btn-chat"
                    >
                      <ArrowUpIcon />
                    </button>
                  </div>
                </div>

                {mentionState && mentionState.active && (
                  <div className="mention-popover-dropdown">
                    <div className="mention-header">Link a chat</div>
                    <div className="mention-list">
                      {recentChats
                        .filter(chat => chat.title.toLowerCase().includes((mentionState.query || '').toLowerCase()))
                        .map((chat) => (
                          <button
                            key={chat.id}
                            className="mention-item"
                            onClick={() => handleSelectMention(chat)}
                          >
                            <ChatBubbleIcon size={14} className="mention-icon" />
                            <span className="mention-title">{chat.title}</span>
                          </button>
                        ))
                      }
                      {recentChats.filter(chat => chat.title.toLowerCase().includes((mentionState.query || '').toLowerCase())).length === 0 && (
                        <div className="mention-no-results">No chats found</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
