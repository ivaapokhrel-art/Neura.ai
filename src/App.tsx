/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  MessageSquare, 
  Search, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  Database, 
  Trash2, 
  ArrowLeft, 
  Check, 
  Heart, 
  Compass, 
  BookOpen, 
  Info, 
  Brain, 
  User, 
  Send, 
  RefreshCw, 
  X, 
  UserPlus, 
  FileText,
  Volume1,
  Pencil,
  Home,
  Link2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Character, Message, ChatSession, PRESET_CATEGORIES } from './types.ts';
import { PRESET_CHARACTERS } from './presets.ts';

export default function App() {
  // --- STATE ---
  const [characters, setCharacters] = useState<Character[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentCategory, setCurrentCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'home' | 'search' | 'create' | 'chat_list' | 'favorites'>('home');
  const [showNsfw, setShowNsfw] = useState<boolean>(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [tempHeartEffectId, setTempHeartEffectId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });
  
  // Character Customizer Form State
  const [charForm, setCharForm] = useState<Omit<Character, 'id' | 'likes'>>({
    name: '',
    tagline: '',
    description: '',
    personalityPrompt: '',
    greetingMessage: '',
    avatarUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Merlin',
    avatarStyle: 'adventurer',
    voiceName: 'Zephyr',
    category: 'Helpers & AI',
    exampleDialogues: '',
    isUserCreated: true,
    isNsfw: false
  });
  const [seedInput, setSeedInput] = useState<string>('HeroicSpirit');
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState<boolean>(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // Chat/Session active state
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isPlayingAudioId, setIsPlayingAudioId] = useState<string | null>(null);
  const [isSynthesizingVoice, setIsSynthesizingVoice] = useState<boolean>(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [memoryLedgerOpen, setMemoryLedgerOpen] = useState<boolean>(false);
  const [personaDrawerOpen, setPersonaDrawerOpen] = useState<boolean>(false);
  const [newMemoryInput, setNewMemoryInput] = useState<string>('');
  const [scrolledToBottom, setScrolledToBottom] = useState<boolean>(true);

  // Link Importer Active State
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importLink, setImportLink] = useState<string>('');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Notifications for learned memories
  const [swipedSessionId, setSwipedSessionId] = useState<string | null>(null);
  const [swipeStartX, setSwipeStartX] = useState<number>(0);
  const [currentSwipeOffset, setCurrentSwipeOffset] = useState<number>(0);

  const handleTouchStart = (sessionId: string, clientX: number) => {
    setSwipedSessionId(sessionId);
    setSwipeStartX(clientX);
    setCurrentSwipeOffset(0);
  };

  const handleTouchMove = (clientX: number) => {
    if (!swipedSessionId) return;
    const diff = clientX - swipeStartX;
    if (diff > 0) {
      setCurrentSwipeOffset(Math.min(diff, 180));
    }
  };

  const handleTouchEnd = () => {
    if (!swipedSessionId) return;
    if (currentSwipeOffset > 105) {
      handleDeleteSession(swipedSessionId);
    }
    setSwipedSessionId(null);
    setCurrentSwipeOffset(0);
  };

  const [memoryNotification, setMemoryNotification] = useState<{
    facts: string[];
    visible: boolean;
    botName: string;
  }>({
    facts: [],
    visible: false,
    botName: ''
  });

  // Refs
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // --- INITIALIZATION ---
  useEffect(() => {
    // 1. Load Custom Characters from LocalStorage
    const storedCustom = localStorage.getItem('anima_custom_characters');
    let customChars: Character[] = [];
    if (storedCustom) {
      try {
        customChars = JSON.parse(storedCustom);
      } catch (e) {
        console.error("Failed to parse custom characters", e);
      }
    }
    setCharacters([...PRESET_CHARACTERS, ...customChars]);

    // 2. Load Chat Sessions from LocalStorage
    const storedSessions = localStorage.getItem('anima_chat_sessions');
    if (storedSessions) {
      try {
        const parsed = JSON.parse(storedSessions);
        setSessions(parsed);
      } catch (e) {
        console.error("Failed to parse sessions", e);
      }
    }

    // 3. Load Favorite bots from LocalStorage
    const storedFavs = localStorage.getItem('anima_favorite_bots');
    if (storedFavs) {
      try {
        setFavorites(JSON.parse(storedFavs));
      } catch (e) {
        console.error("Failed to parse favorites", e);
      }
    }
  }, []);

  // Sync sessions to localStorage
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('anima_chat_sessions', JSON.stringify(sessions));
    }
  }, [sessions]);

  // DiceBear Avatar synchronization
  useEffect(() => {
    if (charForm.avatarStyle !== 'custom') {
      const generatedUrl = `https://api.dicebear.com/7.x/${charForm.avatarStyle}/svg?seed=${encodeURIComponent(seedInput)}`;
      setCharForm(prev => ({ ...prev, avatarUrl: generatedUrl }));
    }
  }, [charForm.avatarStyle, seedInput]);

  // Scroll to bottom of chat
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [sessions, activeSessionId]);

  // Cleanup audio upon unmount
  useEffect(() => {
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
    };
  }, []);

  // --- CONTROLLERS ---

  // Generate an avatar using Gemini-Image Model
  const handleAIAvatarGeneration = async () => {
    if (!charForm.name || !charForm.tagline) {
      setAvatarError("Please enter both Name and Tagline to let the AI design the profile art.");
      return;
    }
    setIsGeneratingAvatar(true);
    setAvatarError(null);

    const artPrompt = `${charForm.name}, ${charForm.tagline}. Circular modern app avatar. ${charForm.description}`;

    try {
      const response = await fetch('/api/avatars/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: artPrompt })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Generation endpoint returned status non-OK");
      }

      const data = await response.json();
      setCharForm(prev => ({ 
        ...prev, 
        avatarStyle: 'custom', 
        avatarUrl: data.avatarUrl 
      }));

    } catch (err: any) {
      console.error(err);
      setAvatarError(err?.message || "Failed to connect to image generation endpoint. Ensure your API key is fully operating.");
    } finally {
      setIsGeneratingAvatar(false);
    }
  };

  // Import a bot from Chai or Character.ai link
  const handleImportBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importLink.trim()) {
      setImportError("Please enter or paste a valid link.");
      return;
    }

    setIsImporting(true);
    setImportError(null);

    try {
      const response = await fetch("/api/import-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link: importLink.trim() }),
      });

      if (!response.ok) {
        let serverError = "";
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            serverError = errData.error;
          }
        } catch (_) {}
        throw new Error(serverError || "Failed to contact the neural importer. Please verify your link.");
      }

      const rawChar = await response.json();
      
      const uniqueId = 'imported-' + Date.now();
      const defaultAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(rawChar.name || "Nebula")}`;

      const newChar: Character = {
        id: uniqueId,
        name: rawChar.name || "Imported Spark",
        tagline: rawChar.tagline || "Imported neural link matrix",
        description: rawChar.description || "Synthesized from Character.ai / Chai active links.",
        personalityPrompt: rawChar.personalityPrompt || "Be an engaging roleplay companion.",
        greetingMessage: rawChar.greetingMessage || "Neural core operational. Direct communications online.",
        avatarUrl: defaultAvatar,
        avatarStyle: 'bottts',
        avatarPrompt: rawChar.avatarPrompt || "A cybernetic artificial intelligence core portrait, 3d, vector",
        voiceName: rawChar.voiceName || 'Zephyr',
        category: rawChar.category || 'Helpers & AI',
        likes: Math.floor(Math.random() * 800) + 200,
        creator: "neural link",
        exampleDialogues: rawChar.exampleDialogues || "",
        isUserCreated: true,
        isNsfw: rawChar.isNsfw || false
      };

      // Add to state and persist
      const updatedChars = [...characters, newChar];
      setCharacters(updatedChars);

      const customOnly = updatedChars.filter(c => c.isUserCreated);
      localStorage.setItem('anima_custom_characters', JSON.stringify(customOnly));

      // Reset importer state
      setImportLink('');
      setIsImportModalOpen(false);

      // Launch session is immediate!
      startChatSession(newChar);

    } catch (err: any) {
      console.error(err);
      setImportError(err.message || "Failed to parse high-quality character profile from link.");
    } finally {
      setIsImporting(false);
    }
  };

  // Create a custom Character
  const handleCreateCharacter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!charForm.name || !charForm.tagline || !charForm.description || !charForm.personalityPrompt || !charForm.greetingMessage) {
      alert("Please fill in all the core fields of your character persona!");
      return;
    }

    const uniqueId = 'custom-' + Date.now();
    const newChar: Character = {
      ...charForm,
      id: uniqueId,
      likes: 0,
      isUserCreated: true
    };

    // Save to State
    const updatedChars = [...characters, newChar];
    setCharacters(updatedChars);

    // Save custom list to LocalStorage
    const customOnly = updatedChars.filter(c => c.isUserCreated);
    localStorage.setItem('anima_custom_characters', JSON.stringify(customOnly));

    // Reset Form
    setCharForm({
      name: '',
      tagline: '',
      description: '',
      personalityPrompt: '',
      greetingMessage: '',
      avatarUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Merlin',
      avatarStyle: 'adventurer',
      voiceName: 'Zephyr',
      category: 'Helpers & AI',
      exampleDialogues: '',
      isUserCreated: true,
      isNsfw: false
    });
    setSeedInput('HeroicSpirit');

    // Automatically navigate to the new character and start chatting!
    startChatSession(newChar);
  };

  // Delete a User-Created Character
  const handleDeleteCharacter = (charId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to permanently delete this character? All active logs will be wiped.")) return;

    const filtered = characters.filter(c => c.id !== charId);
    setCharacters(filtered);

    const customOnly = filtered.filter(c => c.isUserCreated);
    localStorage.setItem('anima_custom_characters', JSON.stringify(customOnly));

    // Delete associated session
    const filteredSessions = sessions.filter(s => s.characterId !== charId);
    setSessions(filteredSessions);

    if (activeSessionId) {
      const activeSesObj = sessions.find(s => s.id === activeSessionId);
      if (activeSesObj && activeSesObj.characterId === charId) {
        setActiveSessionId(null);
        setActiveTab('home');
      }
    }
  };

  // --- ACTIONS & HELPERS ---

  // Toggle favorite helper
  const toggleFavorite = (charId: string) => {
    setFavorites(prev => {
      const next = prev.includes(charId) 
        ? prev.filter(id => id !== charId) 
        : [...prev, charId];
      localStorage.setItem('anima_favorite_bots', JSON.stringify(next));
      return next;
    });
  };

  // Double-click handler for character card
  const handleCardDoubleClick = (charId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(charId);
    setTempHeartEffectId(charId);
    setTimeout(() => {
      setTempHeartEffectId(null);
    }, 800);
  };

  // Delete message inside an active chat session
  const handleDeleteMessage = (msgId: string) => {
    if (!activeSessionId) return;
    setConfirmModal({
      isOpen: true,
      title: "Delete Message",
      message: "Are you sure you want to delete this message? This action is permanent and cannot be undone.",
      onConfirm: () => {
        setSessions(prev => prev.map(s => {
          if (s.id === activeSessionId) {
            return {
              ...s,
              messages: s.messages.filter(m => m.id !== msgId)
            };
          }
          return s;
        }));
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Start editing a message
  const handleStartEditMessage = (msgId: string, currentText: string) => {
    setEditingMessageId(msgId);
    setEditingText(currentText);
  };

  // Save the edited message
  const handleSaveEditMessage = (msgId: string) => {
    if (!activeSessionId || !editingText.trim()) return;
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        return {
          ...s,
          messages: s.messages.map(m => m.id === msgId ? { ...m, text: editingText.trim() } : m)
        };
      }
      return s;
    }));
    setEditingMessageId(null);
    setEditingText('');
  };

  // Regenerate an assistant response to the user's previous message
  const handleRegenerateMessage = async (msgId: string) => {
    if (!activeSessionId || !activeChar) return;

    // Find the current session and the index of the message to regenerate
    const session = sessions.find(s => s.id === activeSessionId);
    if (!session) return;
    const msgIndex = session.messages.findIndex(m => m.id === msgId);
    if (msgIndex === -1) return;

    // Get all conversation messages up to (not including) the selected assistant message
    const priorMessages = session.messages.slice(0, msgIndex);
    
    // Create generating placeholder
    const aiPlaceholdingMsg: Message = {
      id: 'msg-ai-gen-' + Date.now(),
      role: 'assistant',
      text: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isGenerating: true
    };

    // Update session: Truncating the history and replacing with placeholder the rest of the conversation
    const updatedMsgs = [...priorMessages, aiPlaceholdingMsg];
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        return { ...s, messages: updatedMsgs };
      }
      return s;
    }));

    try {
      const contextMessages = priorMessages.slice(-15).map(m => ({ role: m.role, text: m.text }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          character: activeChar,
          messages: contextMessages,
          memoryLedger: session.memoryLedger
        })
      });

      if (!response.ok) {
        const errorText = await response.json();
        throw new Error(errorText.error || "Failed generation from backend.");
      }

      const data = await response.json();

      let ledgerUpdates: string[] = [...session.memoryLedger];
      if (data.learnedMemories && data.learnedMemories.length > 0) {
        const uniqueNew = data.learnedMemories.filter((fact: string) => !ledgerUpdates.includes(fact));
        if (uniqueNew.length > 0) {
          ledgerUpdates = [...ledgerUpdates, ...uniqueNew];
          setMemoryNotification({
            facts: uniqueNew,
            visible: true,
            botName: activeChar.name
          });
          setTimeout(() => {
            setMemoryNotification(prev => ({ ...prev, visible: false }));
          }, 6000);
        }
      }

      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          const finalMessages = s.messages.map(m => {
            if (m.id === aiPlaceholdingMsg.id) {
              return {
                ...m,
                text: data.text,
                isGenerating: false
              };
            }
            return m;
          });
          return {
            ...s,
            messages: finalMessages,
            memoryLedger: ledgerUpdates
          };
        }
        return s;
      }));

    } catch (err: any) {
      console.error(err);
      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          const finalMessages = s.messages.map(m => {
            if (m.id === aiPlaceholdingMsg.id) {
              return {
                ...m,
                text: `*System Error: Could not reach character network (${err?.message || "Verify your connection"}).*`,
                isGenerating: false
              };
            }
            return m;
          });
          return { ...s, messages: finalMessages };
        }
        return s;
      }));
    }
  };

  // Delete all chat sessions with confirmation
  const handleDeleteAllChats = () => {
    setConfirmModal({
      isOpen: true,
      title: "Delete All Chat History",
      message: "Are you sure you want to permanently delete all chats with all characters? This action cannot be undone.",
      onConfirm: () => {
        setSessions([]);
        localStorage.removeItem('anima_chat_sessions');
        setActiveSessionId(null);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Delete individual chat session with confirmation (can also be triggered by swiping right)
  const handleDeleteSession = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const char = characters.find(c => c.id === session.characterId);
    const charName = char ? char.name : "this character";

    setConfirmModal({
      isOpen: true,
      title: `Delete Chat with ${charName}`,
      message: `Are you sure you want to permanently clear your chat history with ${charName}?`,
      onConfirm: () => {
        const updated = sessions.filter(s => s.id !== sessionId);
        setSessions(updated);
        localStorage.setItem('anima_chat_sessions', JSON.stringify(updated));
        if (activeSessionId === sessionId) {
          setActiveSessionId(null);
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Start or resume a Chat Session with a character
  const startChatSession = (char: Character) => {
    // Check if there is already an active session for this character
    const existingSession = sessions.find(s => s.characterId === char.id);

    if (existingSession) {
      setActiveSessionId(existingSession.id);
    } else {
      // Create fresh new session
      const newSessionId = 'session-' + Date.now();
      const freshSession: ChatSession = {
        id: newSessionId,
        characterId: char.id,
        messages: [
          {
            id: 'greet-' + Date.now(),
            role: 'assistant',
            text: char.greetingMessage,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ],
        memorySummary: '',
        memoryLedger: []
      };

      setSessions(prev => [freshSession, ...prev]);
      setActiveSessionId(newSessionId);
    }

    setActiveTab('chat');
    setMemoryLedgerOpen(false);
    setPersonaDrawerOpen(false);
  };

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const activeChar = activeSession ? characters.find(c => c.id === activeSession.characterId) : null;

  // Send communication to Gemini for Character AI Response
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !activeSession || !activeChar) return;

    const userMsgText = inputMessage.trim();
    setInputMessage('');

    const userMessageObj: Message = {
      id: 'msg-user-' + Date.now(),
      role: 'user',
      text: userMsgText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const aiPlaceholdingMsg: Message = {
      id: 'msg-ai-gen-' + Date.now(),
      role: 'assistant',
      text: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isGenerating: true
    };

    // 1. Immediately append User message and Generating Placeholder to UI
    let updatedMsgs = [...activeSession.messages, userMessageObj, aiPlaceholdingMsg];
    
    setSessions(prev => prev.map(s => {
      if (s.id === activeSession.id) {
        return { ...s, messages: updatedMsgs };
      }
      return s;
    }));

    try {
      // Limit actual conversation history sent back to prevent token overfill but preserve context
      // Send the last 15 messages for high fidelity chat recall
      const contextMessages = updatedMsgs
        .filter(m => m.id !== aiPlaceholdingMsg.id)
        .slice(-15)
        .map(m => ({ role: m.role, text: m.text }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          character: activeChar,
          messages: contextMessages,
          memoryLedger: activeSession.memoryLedger
        })
      });

      if (!response.ok) {
        const errorText = await response.json();
        throw new Error(errorText.error || "Failed generation from backend.");
      }

      const data = await response.json();

      let ledgerUpdates: string[] = [...activeSession.memoryLedger];
      
      // Dynamic Memory Ledger notification logic
      if (data.learnedMemories && data.learnedMemories.length > 0) {
        // Prevent duplicate memories
        const uniqueNew = data.learnedMemories.filter((fact: string) => !ledgerUpdates.includes(fact));
        if (uniqueNew.length > 0) {
          ledgerUpdates = [...ledgerUpdates, ...uniqueNew];
          
          // Trigger floating visual alert
          setMemoryNotification({
            facts: uniqueNew,
            visible: true,
            botName: activeChar.name
          });

          setTimeout(() => {
            setMemoryNotification(prev => ({ ...prev, visible: false }));
          }, 6000);
        }
      }

      // 2. Overwrite placeholder with actual generated character reply
      setSessions(prev => prev.map(s => {
        if (s.id === activeSession.id) {
          const finalMessages = s.messages.map(m => {
            if (m.id === aiPlaceholdingMsg.id) {
              return {
                ...m,
                text: data.text,
                isGenerating: false
              };
            }
            return m;
          });
          return {
            ...s,
            messages: finalMessages,
            memoryLedger: ledgerUpdates
          };
        }
        return s;
      }));

    } catch (err: any) {
      console.error(err);
      // Remove placeholder & show error bubble
      setSessions(prev => prev.map(s => {
        if (s.id === activeSession.id) {
          const finalMessages = s.messages.map(m => {
            if (m.id === aiPlaceholdingMsg.id) {
              return {
                ...m,
                text: `*System Error: Could not reach the character's core neural interface (${err?.message || "Verify your backend server and Gemini API key configuration"}).*`,
                isGenerating: false
              };
            }
            return m;
          });
          return { ...s, messages: finalMessages };
        }
        return s;
      }));
    }
  };

  // TTS generation & audio playback
  const handleSpeakMessage = async (msgId: string, text: string) => {
    if (!activeChar) return;

    // If currently playing, toggle off
    if (isPlayingAudioId === msgId) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        setIsPlayingAudioId(null);
      }
      return;
    }

    setIsSynthesizingVoice(true);
    setVoiceError(null);

    // Look for existing cached audio for this message
    const msgObj = activeSession?.messages.find(m => m.id === msgId);
    if (msgObj?.voiceAudioUrl) {
      playAudioBlob(msgId, msgObj.voiceAudioUrl);
      setIsSynthesizingVoice(false);
      return;
    }

    try {
      const response = await fetch('/api/voice/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          voiceName: activeChar.voiceName,
          characterName: activeChar.name
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to synthesize speech.");
      }

      const data = await response.json();
      const base64Url = data.audioData;

      // Cache speech URL so user doesn't hit model cost/latency repeatedly for same message
      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          const updated = s.messages.map(m => {
            if (m.id === msgId) {
              return { ...m, voiceAudioUrl: base64Url };
            }
            return m;
          });
          return { ...s, messages: updated };
        }
        return s;
      }));

      playAudioBlob(msgId, base64Url);

    } catch (err: any) {
      console.error(err);
      setVoiceError("Unable to synthesize speech. Ensure server connectivity.");
      setTimeout(() => setVoiceError(null), 3000);
    } finally {
      setIsSynthesizingVoice(false);
    }
  };

  const playAudioBlob = (msgId: string, base64AudioUrl: string) => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.src = base64AudioUrl;
      audioPlayerRef.current.play()
        .then(() => {
          setIsPlayingAudioId(msgId);
          audioPlayerRef.current!.onended = () => {
            setIsPlayingAudioId(null);
          };
        })
        .catch(err => {
          console.error("Audio playback failure", err);
          setIsPlayingAudioId(null);
        });
    }
  };

  // Memory Ledger Maintenance (User Adding facts manually)
  const handleAddNewMemory = () => {
    if (!newMemoryInput.trim() || !activeSessionId) return;

    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        const updatedLedger = [...s.memoryLedger, newMemoryInput.trim()];
        return { ...s, memoryLedger: updatedLedger };
      }
      return s;
    }));
    setNewMemoryInput('');
  };

  // Delete specific Memory Row
  const handleDeleteMemoryRow = (index: number) => {
    if (!activeSessionId) return;

    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        const updatedLedger = [...s.memoryLedger];
        updatedLedger.splice(index, 1);
        return { ...s, memoryLedger: updatedLedger };
      }
      return s;
    }));
  };

  // Clear Chat History completely
  const handleResetChatHistory = () => {
    if (!activeSession || !activeChar) return;
    if (!confirm("Are you sure you want to clear your current conversation chat history with this bot? Memory ledger logs will remain intact.")) return;

    const resetMessages: Message[] = [
      {
        id: 'greet-' + Date.now(),
        role: 'assistant',
        text: activeChar.greetingMessage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];

    setSessions(prev => prev.map(s => {
      if (s.id === activeSession.id) {
        return { ...s, messages: resetMessages };
      }
      return s;
    }));
  };

  // --- FILTERS ---
  const unconversedCharacters = characters.filter(char => {
    const session = sessions.find(s => s.characterId === char.id);
    const hasChatted = session && session.messages.some(m => m.role === 'user');
    const matchesCategory = currentCategory === 'All' || char.category === currentCategory;
    const matchesNsfw = showNsfw ? true : !char.isNsfw;
    return !hasChatted && matchesCategory && matchesNsfw;
  });

  const searchCharacters = characters.filter(char => {
    const matchesNsfw = showNsfw ? true : !char.isNsfw;
    if (!searchQuery.trim()) return matchesNsfw;
    
    const cleanStr = (s: string) => s.replace(/\s+/g, '').toLowerCase();
    const queryClean = cleanStr(searchQuery);
    
    const nameMatch = cleanStr(char.name).includes(queryClean);
    const taglineMatch = cleanStr(char.tagline || '').includes(queryClean);
    const descMatch = cleanStr(char.description || '').includes(queryClean);
    
    return (nameMatch || taglineMatch || descMatch) && matchesNsfw;
  });

  const favoriteCharacters = characters.filter(char => {
    const matchesNsfw = showNsfw ? true : !char.isNsfw;
    return favorites.includes(char.id) && matchesNsfw;
  });

  const activeChatSessions = sessions.filter(s => {
    const char = characters.find(c => c.id === s.characterId);
    if (!char) return false;
    const matchesNsfw = showNsfw ? true : !char.isNsfw;
    const hasChatted = s.messages.some(m => m.role === 'user');
    return hasChatted && matchesNsfw;
  });

  const filteredCharacters = characters.filter(c => {
    const matchesCategory = currentCategory === 'All' || c.category === currentCategory;
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.tagline.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesNsfw = showNsfw ? true : !c.isNsfw;
    return matchesCategory && matchesSearch && matchesNsfw;
  });

  const renderCharacterCard = (char: Character) => {
    const isFav = favorites.includes(char.id);
    return (
      <div
        key={char.id}
        id={`char-card-${char.id}`}
        onClick={() => startChatSession(char)}
        onDoubleClick={(e) => handleCardDoubleClick(char.id, e)}
        className="group relative bg-[#0D0D0D] hover:bg-[#111] border border-[#222] hover:border-violet-500/30 rounded-2xl p-5 flex flex-col justify-between cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-950/5 select-none"
      >
        {/* Double-click Heart Pop Animation effect */}
        {tempHeartEffectId === char.id && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-2xl z-20 pointer-events-none">
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.4, 1], opacity: [0, 1, 0] }}
              transition={{ duration: 0.6 }}
            >
              <Heart size={44} className="text-rose-500 fill-rose-500 animate-pulse" />
            </motion.div>
          </div>
        )}

        {/* Favorite badge in top right */}
        {isFav && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggleFavorite(char.id); }}
            className="absolute top-3 right-3 p-1.5 bg-black/50 hover:bg-black/80 rounded-full border border-rose-500/20 text-rose-500 transition-all z-10"
            title="Remove from favorites"
          >
            <Heart size={14} className="fill-rose-500 text-rose-500" />
          </button>
        )}

        <div>
          {/* Banner background decor */}
          <div className="absolute top-0 inset-x-0 h-1.5 rounded-t-2xl bg-gradient-to-r from-violet-950/40 to-transparent border-b border-[#262626] group-hover:from-violet-500/30 group-hover:to-transparent" />
          
          {/* Header content */}
          <div className="flex gap-4 items-start pt-2">
            <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-[#161616] flex-shrink-0 border border-[#262626] shadow-md">
              <img 
                src={char.avatarUrl} 
                alt={char.name} 
                className="w-full h-full object-cover scale-105 group-hover:scale-110 transition-transform"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center flex-wrap gap-1.5">
                <h4 className="font-semibold text-sm text-white truncate group-hover:text-violet-400 transition-colors">{char.name}</h4>
                {char.isUserCreated && (
                  <span className="text-[8px] font-mono font-bold tracking-widest px-1.5 py-0.5 uppercase bg-violet-600/20 text-violet-300 rounded leading-none">User Created</span>
                )}
                {char.isNsfw && (
                  <span className="text-[8px] font-mono font-bold tracking-wider px-1.5 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded leading-none">18+ NSFW</span>
                )}
              </div>
              <p className="text-[10px] text-gray-500 truncate">@{char.creator.toLowerCase()}</p>
              <span className="inline-block mt-1 text-[9px] font-mono px-2 py-0.5 bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-full">
                {char.category}
              </span>
            </div>
          </div>

          {/* Tagline */}
          <p className="text-xs text-gray-400 mt-4 line-clamp-2 leading-relaxed">
            {char.tagline}
          </p>
        </div>

        {/* Card Footer interaction statistics */}
        <div className="border-t border-[#222] mt-5 pt-3.5 flex items-center justify-between">
          <span className="text-[10px] font-mono text-gray-500 flex items-center gap-1.5 group-hover:text-violet-400 transition-colors">
            <MessageSquare size={12} className="opacity-70" />
            {char.likes.toLocaleString()} conversations
          </span>

          <div className="flex gap-1.5">
            {char.isUserCreated && (
              <button
                id={`delete-char-btn-${char.id}`}
                onClick={(e) => handleDeleteCharacter(char.id, e)}
                className="p-1.5 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="Delete character"
              >
                <Trash2 size={13} />
              </button>
            )}
            <span 
              id={`chat-action-${char.id}`}
              className="text-xs font-semibold text-violet-400 group-hover:text-white bg-[#161616] group-hover:bg-violet-600 px-3 py-1.5 rounded-xl transition-all"
            >
              Chat ➜
            </span>
          </div>
        </div>

      </div>
    );
  };

  return (
    <div id="anima-app-container" className="min-h-screen bg-[#0A0A0A] text-gray-200 font-sans flex flex-col md:flex-row antialiased overflow-x-hidden">
      
      {/* Hidden Audio element for Text-To-Speech Playback */}
      <audio id="anima-tts-player" ref={audioPlayerRef} className="hidden" />

      {/* --- TOP HEADER (logo & custom controls) --- */}
      {!activeSessionId && (
        <header className="h-16 px-6 bg-[#0E0E0E]/90 border-b border-[#1A1A1A] flex items-center justify-between sticky top-0 z-30 backdrop-blur-md select-none">
          <div className="flex items-center gap-2.5">
            <div className="bg-gradient-to-tr from-violet-500 to-fuchsia-500 p-1.5 rounded-lg font-sans">
              <Brain size={16} className="text-white animate-pulse" />
            </div>
            <span className="font-bold tracking-tight text-white font-sans text-sm md:text-base">NEURA.AI</span>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === 'chat_list' && activeChatSessions.length > 0 && (
              <button
                type="button"
                onClick={handleDeleteAllChats}
                className="text-xs font-semibold px-3 py-1.5 bg-rose-950/40 text-rose-400 hover:text-white border border-rose-900/30 hover:bg-rose-600 rounded-xl transition-all flex items-center gap-1.5"
              >
                <Trash2 size={13} /> Delete All Threads
              </button>
            )}
            <div className="flex items-center gap-1.5 pr-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-[10px] font-mono font-semibold tracking-wider text-emerald-400 uppercase">Interactive</span>
            </div>
          </div>
        </header>
      )}

      {/* --- MAIN CENTRAL ACTION VIEW --- */}
      <main id="main-content" className="flex-1 flex flex-col min-w-0 relative h-full">

        <AnimatePresence mode="wait">
          
          {/* ==========================================
              1. HOME VIEW (UNCONVERSED PERSONAS)
              ========================================== */}
          {!activeSessionId && activeTab === 'home' && (
            <motion.div
              key="home-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex-1 overflow-y-auto px-4 md:px-10 py-6 pb-32 max-w-6xl mx-auto w-full space-y-6 animate-fade-in"
            >
              {/* Promo Banner / Intro card */}
              <div className="relative overflow-hidden rounded-3xl border border-[#1C1C1C] bg-[#0E0E0E] p-6 md:p-8">
                <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/5 rounded-full blur-3xl pointer-events-none" />
                <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">Meet Your Digital Sparks</h2>
                <p className="text-xs text-gray-400 mt-2 max-w-xl leading-relaxed">
                  Forge hyper-realistic custom intelligence matrices or converse offline with pristine AI personas. Double-click any Bot card below to save them to your **Favorites** tray instantly!
                </p>

                {/* Quick Toggle Adults Filter */}
                <div className="flex items-center gap-3 mt-5 select-none font-sans">
                  <span className="text-xs text-gray-400 font-semibold">18+ NSFW Content Access</span>
                  <button
                    type="button"
                    id="toggle-nsfw-btn"
                    onClick={() => setShowNsfw(!showNsfw)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors outline-none cursor-pointer ${
                      showNsfw ? 'bg-violet-600' : 'bg-[#222]'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        showNsfw ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Filters Slider */}
              <div className="flex gap-2 overflow-x-auto scrollbar-none py-1.5 font-sans">
                {PRESET_CATEGORIES.map(category => (
                  <button
                    key={category}
                    id={`cat-filter-${category.replace(/\s+/g, '-').toLowerCase()}`}
                    onClick={() => setCurrentCategory(category)}
                    className={`whitespace-nowrap px-4 py-2 text-xs font-semibold rounded-full transition-all flex items-center gap-1.5 border cursor-pointer border-transparent ${
                      currentCategory === category
                        ? 'bg-[#1A1A1A] text-violet-400 border-violet-500/30'
                        : 'bg-[#161616] text-gray-400 border-[#262626] hover:border-[#333] hover:text-white'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              {/* BOTS GRID */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 font-mono flex items-center gap-2 select-none">
                  <Compass size={14} className="text-violet-400" />
                  {currentCategory === 'All' ? 'Suggested Personas' : `${currentCategory}`}
                  <span className="text-xs text-gray-500 font-normal">({unconversedCharacters.length} available)</span>
                </h3>

                {unconversedCharacters.length === 0 ? (
                  <div className="text-center py-16 bg-[#0E0E0E] rounded-3xl border border-[#222] select-none p-4">
                    <Search size={36} className="text-gray-600 mx-auto mb-3 animate-pulse" />
                    <h4 className="text-gray-400 font-semibold mb-1">None available right now</h4>
                    <p className="text-xs text-gray-600 font-sans">You have conversed with all bots in this query. Check "Chat" tab!</p>
                  </div>
                ) : (
                  <div id="character-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {unconversedCharacters.map(char => renderCharacterCard(char))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ==========================================
              1b. SEARCH VIEW (CASE & SPACE INSENSITIVE)
              ========================================== */}
          {!activeSessionId && activeTab === 'search' && (
            <motion.div
              key="search-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex-1 overflow-y-auto px-4 md:px-10 py-6 pb-32 max-w-6xl mx-auto w-full space-y-6 animate-fade-in"
            >
              <div className="bg-[#0E0E0E] border border-[#222] p-5 rounded-3xl space-y-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2 select-none">
                  <Search size={16} className="text-violet-400" /> Insensitive Matrix Search
                </h2>
                
                <div className="relative">
                  <input
                    type="text"
                    id="search-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search characters by name, tagline, or biography details..."
                    className="w-full pl-11 pr-10 py-3.5 bg-[#141414] border border-[#222] focus:border-violet-500 rounded-2xl text-xs text-white outline-none placeholder-gray-600 transition-all font-sans"
                  />
                  <Search size={15} className="absolute left-4 top-4 text-gray-500" />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-4 top-4 text-gray-500 hover:text-white transition-all font-sans"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Advanced Adult Filter controls */}
                <div className="flex items-center justify-between border-t border-[#1C1C1C] pt-3 text-xs text-gray-500 font-mono select-none">
                  <span>Space & Case Insensitive Matcher</span>
                  <div className="flex items-center gap-2">
                    <span>Adult Filter (NSFW)</span>
                    <button
                      type="button"
                      onClick={() => setShowNsfw(!showNsfw)}
                      className={`px-3 py-1 rounded-full border text-[10px] font-bold transition-all cursor-pointer ${
                        showNsfw ? 'border-rose-500 bg-rose-500/10 text-rose-400' : 'border-gray-800 bg-transparent text-gray-500'
                      }`}
                    >
                      {showNsfw ? "18+ UNLOCKED" : "18+ FILTERED"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Search Results Grid */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 font-mono select-none">
                  Search Results ({searchCharacters.length})
                </h3>

                {searchCharacters.length === 0 ? (
                  <div className="text-center py-20 bg-[#0E0E0E] rounded-3xl border border-[#222] select-none p-4">
                    <Search size={40} className="text-gray-600 mx-auto mb-4" />
                    <h4 className="text-gray-400 font-bold mb-1">No matches in cyberspace</h4>
                    <p className="text-xs text-gray-600 font-sans">Try keywords like "doctor", "AI", "witcher", or custom names.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {searchCharacters.map(char => renderCharacterCard(char))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ==========================================
              1c. FAVORITES VIEW (heart-tray selection)
              ========================================== */}
          {!activeSessionId && activeTab === 'favorites' && (
            <motion.div
              key="favorites-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex-1 overflow-y-auto px-4 md:px-10 py-6 pb-32 max-w-6xl mx-auto w-full space-y-6 animate-fade-in"
            >
              <div className="flex items-center justify-between border-b border-[#1C1C1C] pb-3 select-none">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Heart size={16} className="text-rose-500 fill-rose-500" /> Favorites Tray
                </h2>
                <span className="text-[10px] font-mono text-gray-500">
                  {favoriteCharacters.length} favorited
                </span>
              </div>

              {favoriteCharacters.length === 0 ? (
                <div className="text-center py-20 bg-[#0E0E0E] rounded-3xl border border-[#222] p-6 select-none">
                  <Heart size={44} className="text-gray-600 mx-auto mb-4 stroke-[1.5px] animate-pulse" />
                  <h4 className="text-gray-400 font-bold mb-1">No Favorited Personas</h4>
                  <p className="text-xs text-gray-600 max-w-sm mx-auto leading-relaxed font-sans">
                    Double-click any bot card in the **Home** or **Search** panels to add target personas to this list instantly!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {favoriteCharacters.map(char => renderCharacterCard(char))}
                </div>
              )}
            </motion.div>
          )}

          {/* ==========================================
              1d. DIALOGUES LIST VIEW (conversed threads with swipe delete)
              ========================================== */}
          {!activeSessionId && activeTab === 'chat_list' && (
            <motion.div
              key="chat-list-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex-1 overflow-y-auto px-4 md:px-10 py-6 pb-32 max-w-6xl mx-auto w-full space-y-6 animate-fade-in"
            >
              <div className="flex items-center justify-between border-b border-[#1C1C1C] pb-3 select-none">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <MessageSquare size={16} className="text-violet-400" /> Active Dialogues
                </h2>
                <span className="text-[10px] font-mono text-gray-500">
                  {activeChatSessions.length} active threads
                </span>
              </div>

              {activeChatSessions.length === 0 ? (
                <div className="text-center py-20 bg-[#0E0E0E] rounded-3xl border border-[#222] p-6 select-none">
                  <MessageSquare size={40} className="text-gray-600 mx-auto mb-4" />
                  <h4 className="text-gray-400 font-bold mb-1">No Dialogue History</h4>
                  <p className="text-xs text-gray-600 max-w-sm mx-auto leading-relaxed font-sans">
                    You haven't initiated chat threads with any personas yet. Visit the **Home** or **Search** trays, and converse with a bot now.
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {activeChatSessions.map(s => {
                    const char = characters.find(c => c.id === s.characterId);
                    if (!char) return null;
                    const lastMsg = s.messages[s.messages.length - 1];

                    return (
                      <div key={s.id} className="relative overflow-hidden rounded-2xl min-h-[80px]">
                        {/* Swipe red trigger backing */}
                        <div className="absolute inset-0 bg-red-600/10 border border-red-900/20 rounded-2xl flex items-center justify-start pl-6 text-red-400 font-bold text-xs pointer-events-none select-none">
                          <Trash2 size={16} className="text-red-500 mr-2" /> Swipe / Slide Right To Delete
                        </div>

                        {/* Swipe controller panel for row */}
                        <div
                          onTouchStart={(e) => handleTouchStart(s.id, e.touches[0].clientX)}
                          onTouchMove={(e) => handleTouchMove(e.touches[0].clientX)}
                          onTouchEnd={handleTouchEnd}
                          onMouseDown={(e) => handleTouchStart(s.id, e.clientX)}
                          onMouseMove={(e) => {
                            if (swipedSessionId === s.id) {
                              handleTouchMove(e.clientX);
                            }
                          }}
                          onMouseUp={handleTouchEnd}
                          onMouseLeave={handleTouchEnd}
                          style={{
                            transform: swipedSessionId === s.id ? `translateX(${currentSwipeOffset}px)` : 'translateX(0px)',
                            transition: swipedSessionId === s.id ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                            userSelect: 'none'
                          }}
                          className="relative bg-[#0E0E0E] hover:bg-[#111111] border border-[#222] rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-colors z-10 select-none"
                          onClick={() => {
                            if (currentSwipeOffset === 0) {
                              setActiveSessionId(s.id);
                              setActiveTab('chat');
                            }
                          }}
                        >
                          <div className="flex items-center gap-4 min-w-0 flex-1">
                            <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-[#161616] border border-[#222] flex-shrink-0">
                              <img src={char.avatarUrl} alt={char.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              {favorites.includes(char.id) && (
                                <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-rose-500 rounded-bl-lg flex items-center justify-center">
                                  <Heart size={8} className="fill-white text-white" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-white text-sm truncate">{char.name}</h4>
                                {char.isUserCreated && (
                                  <span className="text-[8px] font-mono px-1.5 py-0.5 bg-violet-600/20 text-violet-300 rounded leading-none">User</span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 truncate mt-1">
                                {lastMsg ? lastMsg.text.replace(/\*[^*]+\*/g, '') : char.tagline}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0 self-center pl-2">
                            <button
                              id={`delete-ses-btn-${s.id}`}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSession(s.id);
                              }}
                              className="p-2 text-gray-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                              title="Delete chat session"
                            >
                              <Trash2 size={16} />
                            </button>
                            <span className="text-xs font-semibold text-violet-400 px-3 py-1.5 bg-violet-600/10 border border-violet-500/20 rounded-xl hover:bg-[#1A1A1A] transition-all">
                              Chat ➜
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* ==========================================
              2. HIGH-QUALITY PERSONA CREATION VIEW
              ========================================== */}
          {activeTab === 'create' && (
            <motion.div
              key="create-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex-1 overflow-y-auto px-4 md:px-10 py-8 max-w-4xl mx-auto w-full"
            >
              <div className="flex items-center gap-4 mb-6">
                <button 
                  id="create-back-btn"
                  onClick={() => { setActiveTab('home'); }}
                  className="p-2 rounded-xl bg-[#0D0D0D] text-gray-400 hover:text-white border border-[#262626]"
                >
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-white">Bot Persona Architect</h2>
                  <p className="text-xs text-gray-500">Configure detailed guidelines, speaking models, initial messages, and synthesize profile art.</p>
                </div>
              </div>

              <form id="create-character-form" onSubmit={handleCreateCharacter} className="space-y-6">
                
                {/* Visual Section: Avatar Art Synthesis */}
                <div className="bg-[#0D0D0D] border border-[#262626] rounded-2xl p-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
                    <Sparkles size={16} className="text-violet-400" /> Step 1: Profile Art Customizer
                  </h3>
                  
                  <div className="flex flex-col md:flex-row gap-6 items-center">
                    {/* Real-time reactive preview */}
                    <div className="relative w-28 h-28 rounded-2xl overflow-hidden bg-[#161616] border-2 border-dashed border-[#262626] flex-shrink-0 flex items-center justify-center p-2">
                      <AnimatePresence mode="wait">
                        {isGeneratingAvatar ? (
                          <motion.div 
                            key="avatar-gen-loader"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-[#0A0A0A]/80 backdrop-blur-sm flex flex-col items-center justify-center p-2 text-center"
                          >
                            <RefreshCw size={24} className="text-violet-400 animate-spin mb-2" />
                            <span className="text-[8px] font-mono tracking-widest text-gray-400 uppercase animate-pulse">Designing Art...</span>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                      <img 
                        src={charForm.avatarUrl} 
                        alt="Avatar preview" 
                        className="w-full h-full object-cover rounded-xl"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    {/* Controls */}
                    <div className="flex-1 space-y-4 w-full">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-400 mb-1.5">Avatar Base Style</label>
                          <select
                            id="avatar-style-select"
                            value={charForm.avatarStyle}
                            onChange={(e: any) => setCharForm(prev => ({ ...prev, avatarStyle: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-[#161616] border border-[#262626] focus:border-violet-500 rounded-xl text-xs text-white outline-none"
                          >
                            <option value="adventurer">Adventurer (Human portraits)</option>
                            <option value="bottts">Bottts (Awesome robots)</option>
                            <option value="lorelei">Lorelei (Elegant flat anime)</option>
                            <option value="avataaars">Avataaars (Casual cartoon)</option>
                            <option value="custom">Custom URL / Synthesized AI Image</option>
                          </select>
                        </div>

                        {charForm.avatarStyle !== 'custom' ? (
                          <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1.5">Avatar Seed Generator</label>
                            <input
                              type="text"
                              id="avatar-seed-input"
                              value={seedInput}
                              onChange={(e) => setSeedInput(e.target.value)}
                              placeholder="Type seed word to reload character look, eg: Max"
                              className="w-full px-4 py-2.5 bg-[#161616] border border-[#262626] focus:border-violet-500 rounded-xl text-xs text-white placeholder-gray-600 outline-none"
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1.5">Custom Image URL</label>
                            <input
                              type="url"
                              id="avatar-custom-url-input"
                              value={charForm.avatarStyle === 'custom' ? charForm.avatarUrl : ''}
                              onChange={(e) => setCharForm(prev => ({ ...prev, avatarStyle: 'custom', avatarUrl: e.target.value }))}
                              placeholder="Input base64 string or absolute https image URL"
                              className="w-full px-4 py-2.5 bg-[#161616] border border-[#262626] focus:border-violet-500 rounded-xl text-xs text-white placeholder-gray-600 outline-none"
                            />
                          </div>
                        )}
                      </div>

                      {/* Gemini generation action */}
                      <div>
                        <button
                          type="button"
                          id="generate-custom-ai-avatar-btn"
                          onClick={handleAIAvatarGeneration}
                          disabled={isGeneratingAvatar || !charForm.name || !charForm.tagline}
                          className="py-2.5 px-4 rounded-xl border border-violet-500/20 bg-violet-600/10 text-violet-400 font-semibold text-xs hover:bg-violet-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                        >
                          <Sparkles size={14} />
                          ✨ Generate Custom AI Avatar with Gemini
                        </button>
                        <p className="text-[10px] text-gray-600 mt-1.5">Uses the character Name, Tagline, and Description with the Gemini Image API once filled above to create original art.</p>
                      </div>

                      {avatarError && (
                        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-xl text-xs">
                          {avatarError}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Core Parameters Section */}
                <div className="bg-[#0D0D0D] border border-[#262626] rounded-2xl p-6 space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                    <Info size={16} className="text-violet-400" /> Step 2: Base Character Card Info
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1.5">Character Name *</label>
                      <input
                        type="text"
                        id="form-bot-name"
                        required
                        value={charForm.name}
                        onChange={(e) => setCharForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g. Sherlock Holmes, Amelia-09, Chef Mochi"
                        className="w-full px-4 py-3 bg-[#161616] border border-[#262626] focus:border-violet-500 rounded-xl text-xs text-white outline-none placeholder-gray-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1.5">Short Intro Tagline *</label>
                      <input
                        type="text"
                        id="form-bot-tagline"
                        required
                        value={charForm.tagline}
                        onChange={(e) => setCharForm(prev => ({ ...prev, tagline: e.target.value }))}
                        placeholder="e.g. An eccentric consulting detective who unpicks logical knots."
                        className="w-full px-4 py-3 bg-[#161616] border border-[#262626] focus:border-violet-500 rounded-xl text-xs text-white outline-none placeholder-gray-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1.5">Category *</label>
                      <select
                        id="form-bot-category"
                        value={charForm.category}
                        onChange={(e: any) => setCharForm(prev => ({ ...prev, category: e.target.value }))}
                        className="w-full px-4 py-3 bg-[#161616] border border-[#262626] focus:border-violet-500 rounded-xl text-xs text-white outline-none"
                      >
                        {PRESET_CATEGORIES.filter(c => c !== 'All').map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1.5">Conversation Voice Settings (TTS) *</label>
                      <select
                        id="form-bot-voice"
                        value={charForm.voiceName}
                        onChange={(e: any) => setCharForm(prev => ({ ...prev, voiceName: e.target.value }))}
                        className="w-full px-4 py-3 bg-[#161616] border border-[#262626] focus:border-violet-500 rounded-xl text-xs text-white outline-none"
                      >
                        <option value="Zephyr">Zephyr (Deep modern, calm neutral)</option>
                        <option value="Kore">Kore (Energetic high-pitch female, sharp tone)</option>
                        <option value="Charon">Charon (Elderly, baritone historical philosopher)</option>
                        <option value="Fenrir">Fenrir (Deep gravel magical male voice, fantasy wizard)</option>
                        <option value="Puck">Puck (Cheerful dynamic cartoon accent, food assistant)</option>
                      </select>
                      <p className="text-[9px] text-gray-500 mt-1.5">Prebuilt speech model loaded into the character's voice engine on the backend.</p>
                    </div>
                  </div>

                  {/* Mature/NSFW setting switch */}
                  <div className="bg-[#111111] border border-rose-500/10 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        Adult Content Flag (18+ NSFW)
                      </h4>
                      <p className="text-[10px] text-gray-400 mt-1">Flag this character if they specialize in adult roleplay, mature topics, or suggestive themes.</p>
                    </div>
                    <button
                      id="form-bot-nsfw-toggle"
                      type="button"
                      onClick={() => setCharForm(prev => ({ ...prev, isNsfw: !prev.isNsfw }))}
                      className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        charForm.isNsfw ? 'bg-rose-600' : 'bg-[#262626]'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          charForm.isNsfw ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5">Greeting Message *</label>
                    <textarea
                      id="form-bot-greeting"
                      required
                      rows={2}
                      value={charForm.greetingMessage}
                      onChange={(e) => setCharForm(prev => ({ ...prev, greetingMessage: e.target.value }))}
                      placeholder="e.g. My name is Sherlock. I see you are holding a pocket knife scratched at the hinges. What case brings you here?"
                      className="w-full px-4 py-3 bg-[#161616] border border-[#262626] focus:border-violet-500 rounded-xl text-xs text-white outline-none placeholder-gray-600 font-mono"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">The first introductory chat message the bot automatically sends to open the connection.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5">Long Biography / Backstory *</label>
                    <textarea
                      id="form-bot-description"
                      required
                      rows={2}
                      value={charForm.description}
                      onChange={(e) => setCharForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Detailed biography, who they are, where they reside, major motives, and character history."
                      className="w-full px-4 py-3 bg-[#161616] border border-[#262626] focus:border-violet-500 rounded-xl text-xs text-white outline-none placeholder-gray-600 leading-relaxed"
                    />
                  </div>
                </div>

                {/* Advanced Personality Logic */}
                <div className="bg-[#0D0D0D] border border-[#262626] rounded-2xl p-6 space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                    <Brain size={16} className="text-violet-400" /> Step 3: Deep Personality & Talk Style Settings
                  </h3>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5">Personality Instructions Prompt *</label>
                    <textarea
                      id="form-bot-personality-prompt"
                      required
                      rows={5}
                      value={charForm.personalityPrompt}
                      onChange={(e) => setCharForm(prev => ({ ...prev, personalityPrompt: e.target.value }))}
                      placeholder="Write deep instructions for the personality behavior. For example: 
- Speech quirks: references victorian era, talks with analytical cold logic. Include *analyzes tea* action cues.
- Motives: wants to solve crimes but gets annoyed by slow people.
- Secrets: has a sweet tooth, loves violin.
- Pronouns: He/Him"
                      className="w-full px-4 py-3 bg-[#161616] border border-[#262626] focus:border-violet-500 rounded-xl text-xs text-white font-mono placeholder-gray-600 leading-relaxed"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">These directions formulate the character's internal instructions engine for high-fidelity roleplay.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5">Example Dialogue Transcripts (Optional)</label>
                    <textarea
                      id="form-bot-dialogues"
                      rows={4}
                      value={charForm.exampleDialogues}
                      onChange={(e) => setCharForm(prev => ({ ...prev, exampleDialogues: e.target.value }))}
                      placeholder={`{{user}}: What is logic?
{{char}}: Logic is the anatomy of thought, Watson. Nothing more, nothing less.
{{user}}: Are you worried about the thunderstorm?
{{char}}: *paces back and forth* Raindrops are merely chemical interactions of atmosphere. Why should logic fret?`}
                      className="w-full px-4 py-3 bg-[#161616] border border-[#262626] focus:border-violet-500 rounded-xl text-xs text-white font-mono placeholder-gray-600 leading-relaxed"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">Simulates conversational dialogue patterns to guide speech rhythm, accents, formatting actions, and emojis.</p>
                  </div>
                </div>

                {/* Submition */}
                <div className="flex gap-4 items-center justify-end">
                  <button
                    type="button"
                    id="form-cancel-btn"
                    onClick={() => setActiveTab('home')}
                    className="py-3.5 px-6 rounded-xl border border-[#262626] text-gray-400 hover:text-white hover:bg-white/5 font-semibold text-sm transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    id="form-save-btn"
                    className="py-3.5 px-8 rounded-xl bg-violet-600 text-white hover:bg-violet-700 font-semibold text-sm shadow-[0_0_12px_rgba(139,92,246,0.3)] transition-all"
                  >
                    Forge Persona Cards
                  </button>
                </div>

              </form>
            </motion.div>
          )}

          {/* ==========================================
              3. INTERACTIVE CHAT ENVIRONMENT VIEW
              ========================================== */}
          {activeTab === 'chat' && activeSession && activeChar && (
            <motion.div
              key="chat-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-row min-h-0 h-screen overflow-hidden"
            >
              <div className="flex-1 flex flex-col min-w-0 h-full">
                
                {/* Chat header area */}
                <header id="chat-header" className="h-16 border-b border-[#262626] bg-[#0D0D0D]/95 backdrop-blur-md px-4 md:px-6 flex items-center justify-between z-10 select-none">
                  <div className="flex items-center gap-3 min-w-0">
                    <button 
                      id="chat-hdr-back-btn" 
                      onClick={() => { setActiveTab('chat_list'); setActiveSessionId(null); }}
                      className="p-1.5 rounded-lg bg-[#161616] text-gray-400 hover:text-white border border-[#262626]"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    {/* Bot avatar */}
                    <div 
                      id="chat-bot-avatar-cnt"
                      onClick={() => setPersonaDrawerOpen(!personaDrawerOpen)}
                      className="relative w-10 h-10 rounded-xl overflow-hidden bg-[#161616] border border-[#262626] flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-violet-500/50 transition-all"
                    >
                      <img 
                        src={activeChar.avatarUrl} 
                        alt={activeChar.name} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    {/* Bot Title Name */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 
                          id="chat-bot-title-name"
                          onClick={() => setPersonaDrawerOpen(!personaDrawerOpen)}
                          className="font-semibold text-sm text-white truncate cursor-pointer hover:text-violet-400"
                        >
                          {activeChar.name}
                        </h3>
                        {activeChar.isUserCreated && (
                          <span className="text-[8px] font-mono font-bold px-1 py-[1px] bg-violet-600/20 text-violet-300 rounded">User</span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500 truncate max-w-xs">{activeChar.tagline}</p>
                    </div>
                  </div>

                  {/* Header Options */}
                  <div className="flex items-center gap-1">
                    {/* Dynamic Memory Trigger */}
                    <button
                      id="toggle-memory-ledger-btn"
                      onClick={() => { setMemoryLedgerOpen(!memoryLedgerOpen); setPersonaDrawerOpen(false); }}
                      className={`h-9 px-3.5 rounded-xl border flex items-center gap-1.5 text-xs font-semibold tracking-tight transition-all relative ${
                        memoryLedgerOpen 
                          ? 'bg-violet-600/20 text-violet-300 border-violet-500/30' 
                          : 'bg-[#161616] text-gray-400 border-[#262626] hover:text-white hover:border-violet-500/30'
                      }`}
                      title="Inspect dynamic memory ledger facts"
                    >
                      <Brain size={14} className={activeSession.memoryLedger.length > 0 ? "text-violet-300 animate-bounce-slow" : ""} />
                      <span className="hidden sm:inline">Memory</span>
                      {activeSession.memoryLedger.length > 0 && (
                        <span className="bg-violet-600 text-white text-[9px] font-mono px-1.5 py-0.2 rounded-full absolute -top-1.5 -right-1 shadow border border-[#0A0A0A]">
                          {activeSession.memoryLedger.length}
                        </span>
                      )}
                    </button>

                    {/* Persona Sheet button */}
                    <button
                      id="toggle-persona-sheet-btn"
                      onClick={() => { setPersonaDrawerOpen(!personaDrawerOpen); setMemoryLedgerOpen(false); }}
                      className={`h-9 px-3.5 rounded-xl border flex items-center gap-1.5 text-xs font-semibold tracking-tight transition-all ${
                        personaDrawerOpen 
                          ? 'bg-violet-600/20 text-violet-300 border-violet-500/30' 
                          : 'bg-[#161616] text-gray-400 border-[#262626] hover:text-white hover:border-violet-500/30'
                      }`}
                      title="View bot rules/persona variables"
                    >
                      <FileText size={14} />
                      <span className="hidden sm:inline">Rules</span>
                    </button>

                    {/* Rest conversation */}
                    <button
                      id="wipe-session-chat-btn"
                      onClick={handleResetChatHistory}
                      className="p-2.5 rounded-xl bg-[#161616] border border-[#262626] text-gray-500 hover:text-rose-400 hover:border-rose-500/20 hover:bg-rose-500/5 transition-all"
                      title="Restart chat logs with character greeting"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </header>

                {/* Main bubble list */}
                <div id="chat-scroller-viewport" className="flex-1 overflow-y-auto px-4 py-6 md:px-10 bg-[#0A0A0A] space-y-6 relative flex flex-col justify-start">
                  
                  {/* Ledger Banner alert when bot learns a new fact */}
                  <AnimatePresence>
                    {memoryNotification.visible && (
                      <motion.div
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="fixed top-18 left-1/2 -translate-x-1/2 md:left-auto md:right-10 md:translate-x-0 z-30 bg-[#111111] border border-violet-500/30 shadow-2xl p-4 rounded-2xl max-w-xs md:max-w-md"
                      >
                        <div className="flex gap-3">
                          <div className="p-2 bg-violet-600/10 text-violet-400 rounded-xl flex items-center justify-center flex-shrink-0 self-start">
                            <Brain size={18} className="animate-pulse" />
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-violet-400 tracking-tight">{memoryNotification.botName} recorded a new memory!</h4>
                            <div className="space-y-1 mt-1">
                              {memoryNotification.facts.map((f, i) => (
                                <p key={i} className="text-[11px] text-gray-400 leading-normal font-mono font-medium">" {f} "</p>
                              ))}
                            </div>
                            <button 
                              onClick={() => setMemoryLedgerOpen(true)} 
                              className="text-[10px] font-semibold text-violet-400 hover:underline mt-2 inline-block"
                            >
                              Open Memory Ledger
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Conversation bubbles mapping */}
                  {activeSession.messages.map((m, index) => {
                    const isUser = m.role === 'user';
                    
                    return (
                      <div
                        key={m.id}
                        id={`msg-row-${m.id}`}
                        className={`flex gap-3 md:gap-4 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                      >
                        {/* Avatar illustration */}
                        {!isUser && (
                          <div className="w-9 h-9 rounded-xl overflow-hidden bg-[#161616] border border-[#262626] flex-shrink-0 self-end">
                            <img 
                              src={activeChar.avatarUrl} 
                              alt={activeChar.name} 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}

                        {/* Speech Bubble */}
                        <div className={`space-y-1 ${isUser ? 'text-right' : 'text-left'}`}>
                          
                          {/* Name header */}
                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-gray-600 px-0.5">
                            <span className="font-semibold text-gray-500">
                              {isUser ? 'You' : activeChar.name}
                            </span>
                            <span>•</span>
                            <span>{m.timestamp}</span>
                          </div>

                          <div 
                            id={`bubble-box-${m.id}`}
                            className={`p-3.5 px-4.5 rounded-2xl relative select-text leading-relaxed text-sm transition-all whitespace-pre-wrap ${
                              isUser 
                                ? 'bg-violet-950/40 text-white rounded-br-sm border border-violet-800/40' 
                                : 'bg-[#0D0D0D] text-gray-200 rounded-bl-sm border border-[#262626]'
                            }`}
                          >
                            {m.isGenerating ? (
                              <div className="flex items-center gap-3 py-1 text-gray-500 select-none">
                                <div className="flex items-center gap-1">
                                  <motion.div 
                                    animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.5, 1, 0.5] }} 
                                    transition={{ repeat: Infinity, duration: 1.2, delay: 0 }} 
                                    className="w-1.5 h-1.5 bg-violet-400 rounded-full shadow-[0_0_8px_rgba(167,139,250,0.6)]" 
                                    id="thinking-dot-1"
                                  />
                                  <motion.div 
                                    animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.5, 1, 0.5] }} 
                                    transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }} 
                                    className="w-1.5 h-1.5 bg-violet-400 rounded-full shadow-[0_0_8px_rgba(167,139,250,0.6)]" 
                                    id="thinking-dot-2"
                                  />
                                  <motion.div 
                                    animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.5, 1, 0.5] }} 
                                    transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }} 
                                    className="w-1.5 h-1.5 bg-violet-400 rounded-full shadow-[0_0_8px_rgba(167,139,250,0.6)]" 
                                    id="thinking-dot-3"
                                  />
                                </div>
                                <span className="text-xs font-mono text-gray-500 tracking-wider flex items-center gap-1.5 uppercase font-medium animate-pulse">
                                  <Brain size={12} className="text-violet-400 animate-bounce-slow" />
                                  {activeChar.name} is thinking...
                                </span>
                              </div>
                            ) : (
                              /* Render italics for action descriptions nicely inside bubbles */
                              editingMessageId === m.id ? (
                                <div className="flex flex-col gap-2.5 min-w-[240px] p-1 font-sans">
                                  <textarea
                                    value={editingText}
                                    onChange={(e) => setEditingText(e.target.value)}
                                    rows={4}
                                    className="w-full text-xs p-2.5 bg-[#141414] text-white rounded-xl border border-violet-500/30 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 outline-none leading-relaxed resize-none font-sans"
                                    placeholder="Edit bot message..."
                                  />
                                  <div className="flex justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setEditingMessageId(null)}
                                      className="px-2.5 py-1 text-[11px] font-semibold text-gray-400 hover:text-white bg-[#1a1a1a] border border-[#262626] rounded-lg hover:bg-white/5 transition-all"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSaveEditMessage(m.id)}
                                      className="px-3 py-1 text-[11px] font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-all shadow-sm"
                                    >
                                      Save Changes
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <span>
                                  {m.text.split('*').map((chunk, chunkIdx) => {
                                    // Odd indexes are inside asterisks
                                    if (chunkIdx % 2 !== 0) {
                                      return <em key={chunkIdx} className="text-violet-300 font-mono italic not-italic opacity-90 text-[13px] tracking-wide">{`*${chunk}*`}</em>;
                                    }
                                    return chunk;
                                  })}
                                </span>
                              )
                            )}
                          </div>

                          {/* Interactive individual buttons under the bubble */}
                          {!isUser && !m.isGenerating && (
                            <div className="flex flex-wrap items-center gap-3.5 px-1 mt-1 text-[11px] font-mono select-none">
                              {/* Read Out Loud TTS Button */}
                              <button
                                id={`speak-btn-${m.id}`}
                                onClick={() => handleSpeakMessage(m.id, m.text)}
                                disabled={isSynthesizingVoice}
                                className={`font-bold flex items-center gap-1 transition-all ${
                                  isPlayingAudioId === m.id
                                    ? 'text-amber-500 hover:text-amber-400'
                                    : 'text-violet-400 hover:text-white'
                                }`}
                                title="Play Voice Audio via synthesized TTS"
                              >
                                {isPlayingAudioId === m.id ? (
                                  <>
                                    <VolumeX size={12} /> Stop
                                  </>
                                ) : (
                                  <>
                                    <Volume2 size={12} /> Play Voice
                                  </>
                                )}
                              </button>

                              {/* Edit Bot Message */}
                              <button
                                id={`edit-msg-btn-${m.id}`}
                                onClick={() => handleStartEditMessage(m.id, m.text)}
                                className="text-gray-400 hover:text-violet-400 font-bold flex items-center gap-1 transition-all"
                                title="Edit this message text"
                              >
                                <Pencil size={11} /> Edit
                              </button>

                              {/* Regenerate Bot Message */}
                              <button
                                id={`regen-msg-btn-${m.id}`}
                                onClick={() => handleRegenerateMessage(m.id)}
                                className="text-gray-400 hover:text-violet-400 font-bold flex items-center gap-1 transition-all"
                                title="Regenerate this response"
                              >
                                <RefreshCw size={11} className="animate-hover-spin" /> Retry
                              </button>

                              {/* Delete Bot Message */}
                              <button
                                id={`delete-msg-btn-${m.id}`}
                                onClick={() => handleDeleteMessage(m.id)}
                                className="text-gray-400 hover:text-rose-400 font-bold flex items-center gap-1 transition-all"
                                title="Delete this message"
                              >
                                <Trash2 size={11} /> Delete
                              </button>

                              {isSynthesizingVoice && isPlayingAudioId === null && (
                                <span className="text-[9px] text-gray-600 animate-pulse">TTS voice loading...</span>
                              )}
                            </div>
                          )}

                        </div>
                      </div>
                    );
                  })}
                  
                  <div ref={chatEndRef} />
                </div>

                {/* Message write entry panel */}
                <div id="chat-input-bar-cnt" className="p-4 border-t border-[#262626] bg-[#0A0A0A] z-10 select-none">
                  <form id="message-creation-form" onSubmit={handleSendMessage} className="max-w-3xl mx-auto flex items-stretch gap-3">
                    <input
                      type="text"
                      id="message-input"
                      required
                      placeholder={`Message ${activeChar.name}...`}
                      value={inputMessage}
                      disabled={activeSession.messages[activeSession.messages.length - 1]?.isGenerating}
                      onChange={(e) => setInputMessage(e.target.value)}
                      autoComplete="off"
                      className="flex-1 bg-[#161616] border border-[#262626] focus:border-violet-500 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-650 outline-none transition-all focus:ring-1 focus:ring-violet-500/30 disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      id="send-message-btn"
                      disabled={!inputMessage.trim() || activeSession.messages[activeSession.messages.length - 1]?.isGenerating}
                      className="px-5 rounded-xl bg-violet-600 text-white hover:bg-violet-500 transition-all flex items-center justify-center flex-shrink-0 disabled:bg-[#161616] disabled:text-gray-600 disabled:border border-transparent"
                    >
                      <Send size={15} />
                    </button>
                  </form>
                  <p className="text-[10px] text-center text-gray-600 mt-2">
                    Characters are simulation bots. Responses do not reflect viewpoints of real persons.
                  </p>
                </div>

              </div>

              {/* ==========================================
                  3A. MEMORY LEDGER SIDEBAR COMPONENT
                  ========================================== */}
              <AnimatePresence>
                {memoryLedgerOpen && (
                  <motion.div
                    id="memory-ledger-panel"
                    initial={{ x: 300, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 300, opacity: 0 }}
                    className="w-80 md:w-96 border-l border-[#262626] bg-[#0D0D0D] flex flex-col h-full flex-shrink-0 relative z-20"
                  >
                    {/* Header */}
                    <div className="p-4.5 border-b border-[#262626] flex items-center justify-between bg-[#0A0A0A]">
                      <div className="flex items-center gap-2 text-violet-400">
                        <Brain size={18} className="animate-pulse" />
                        <h4 className="font-semibold text-sm text-white">Dynamic Memory Ledger</h4>
                      </div>
                      <button 
                        id="close-memory-ledger-btn"
                        onClick={() => setMemoryLedgerOpen(false)}
                        className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {/* Meta info of memory capability */}
                    <div className="p-4 bg-[#111111] border-b border-[#262626] text-[11px] leading-relaxed text-gray-400">
                      <span className="font-semibold text-violet-400">Active Auto-memorization is working.</span> As you discuss stable traits or events (such as names, background history, interests) in conversation, <span className="font-semibold text-white">{activeChar.name}</span> will automatically isolate facts and append them below to recall continually!
                    </div>

                    {/* Active memories listed list */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      
                      {/* List elements */}
                      <div className="space-y-2">
                        <h5 className="text-[10px] font-mono font-bold tracking-wider uppercase text-gray-500">Remembered logs ({activeSession.memoryLedger.length})</h5>
                        
                        {activeSession.memoryLedger.length === 0 ? (
                          <div className="text-center py-10 bg-[#161616] border border-dashed border-[#262626] rounded-xl px-4 select-none">
                            <Brain size={24} className="text-gray-600 mx-auto mb-2" />
                            <p className="text-[11px] text-gray-500 italic leading-normal">Merlin's slate is currently blank. Start talking details of your age, profession, preferences, or append your own memory fact below!</p>
                          </div>
                        ) : (
                          <div id="memory-ledger-rows" className="space-y-2">
                            {activeSession.memoryLedger.map((fact, index) => (
                              <div
                                key={index}
                                id={`memory-row-${index}`}
                                className="group relative bg-[#161616] border border-[#262626] rounded-xl p-3 text-xs leading-relaxed text-gray-350 flex items-start gap-2 justify-between hover:border-violet-500/30 transition-all font-mono"
                              >
                                <span className="flex-1 text-violet-300 font-medium">
                                  {fact}
                                </span>
                                <button
                                  id={`delete-memory-row-${index}`}
                                  onClick={() => handleDeleteMemoryRow(index)}
                                  className="text-gray-500 group-hover:text-rose-450 p-0.5 rounded opacity-70 group-hover:opacity-100 hover:bg-rose-500/15"
                                  title="Delete fact"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Manual Append element */}
                      <div className="border-t border-[#262626] pt-4 mt-6">
                        <label className="block text-xs font-semibold text-gray-400 mb-1.5 flex items-center gap-1">
                          <Plus size={12} /> Append Custom Memory Log
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            id="custom-memory-row-input"
                            placeholder="e.g. User works as stellar architect"
                            value={newMemoryInput}
                            onChange={(e) => setNewMemoryInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleAddNewMemory(); }}
                            className="flex-1 bg-[#161616] border border-[#262626] focus:border-violet-500 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 outline-none font-mono"
                          />
                          <button
                            onClick={handleAddNewMemory}
                            disabled={!newMemoryInput.trim()}
                            className="bg-violet-600 text-white p-2.5 rounded-xl disabled:bg-[#161616] disabled:text-gray-600 hover:bg-violet-500 transition-all flex items-center justify-center flex-shrink-0"
                          >
                            <Check size={14} />
                          </button>
                        </div>
                        <p className="text-[9px] text-gray-500 mt-2">Write facts in the objective third person: "User study ancient history", "User has dog named Rusty".</p>
                      </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ==========================================
                  3B. PERSONA CARD SHEET RULES SIDEBAR
                  ========================================== */}
              <AnimatePresence>
                {personaDrawerOpen && (
                  <motion.div
                    id="persona-details-panel"
                    initial={{ x: 300, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 300, opacity: 0 }}
                    className="w-80 md:w-96 border-l border-[#262626] bg-[#0D0D0D] flex flex-col h-full flex-shrink-0 z-20"
                  >
                    {/* Header */}
                    <div className="p-4.5 border-b border-[#262626] flex items-center justify-between bg-[#0A0A0A]">
                      <div className="flex items-center gap-2 text-violet-400">
                        <BookOpen size={16} />
                        <h4 className="font-semibold text-sm text-white">Persona Matrix Rules</h4>
                      </div>
                      <button 
                        id="close-persona-panel-btn"
                        onClick={() => setPersonaDrawerOpen(false)}
                        className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {/* Grid scrolling metadata */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-5 select-text text-xs leading-relaxed text-gray-400">
                      
                      <div className="flex gap-4 items-center border-b border-[#262626] pb-4">
                        <div className="w-14 h-14 rounded-2xl overflow-hidden bg-[#161616] border border-[#262626] flex-shrink-0">
                          <img 
                            src={activeChar.avatarUrl} 
                            alt={activeChar.name} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div>
                          <h5 className="font-semibold text-sm text-white">{activeChar.name}</h5>
                          <p className="text-[10px] text-gray-500">Created by @{activeChar.creator.toLowerCase()}</p>
                          <span className="inline-block mt-1 text-[9px] font-mono px-2 py-0.5 bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-full">
                            {activeChar.category}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <h6 className="text-[9px] font-mono tracking-wider text-gray-500 uppercase font-bold">Tagline</h6>
                        <p className="text-white italic">"{activeChar.tagline}"</p>
                      </div>

                      <div className="space-y-1.5">
                        <h6 className="text-[9px] font-mono tracking-wider text-gray-500 uppercase font-bold">Backstory / Origin</h6>
                        <p>{activeChar.description}</p>
                      </div>

                      <div className="space-y-1.5">
                        <h6 className="text-[9px] font-mono tracking-wider text-gray-500 uppercase font-bold">Personality Settings & Secret variables</h6>
                        <div className="p-3 bg-[#161616] border border-[#262626] rounded-xl font-mono text-[11px] whitespace-pre-wrap text-violet-300">
                          {activeChar.personalityPrompt}
                        </div>
                      </div>

                      {activeChar.exampleDialogues && (
                        <div className="space-y-1.5">
                          <h6 className="text-[9px] font-mono tracking-wider text-gray-500 uppercase font-bold">Example Dialogue Matrix</h6>
                          <div className="p-3 bg-[#161616] border border-[#262626] rounded-xl font-mono text-[11px] whitespace-pre-wrap text-violet-400/90">
                            {activeChar.exampleDialogues}
                          </div>
                        </div>
                      )}

                      <div className="p-3 bg-violet-950/10 border border-violet-500/20 rounded-xl flex items-start gap-2">
                        <Info size={14} className="text-violet-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-violet-300 text-[11px]">Neural configuration is active</p>
                          <p className="text-[9px] text-gray-500 leading-normal mt-0.5">These parameters are injected at the root layer of every conversational prompt to sustain impeccable immersion.</p>
                        </div>
                      </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* --- FULL DECK BOTTOM TASKBAR NAVIGATION (covers bottom completely) --- */}
      {!activeSessionId && (
        <div className="fixed bottom-0 left-0 right-0 w-full bg-[#0D0D0DEE]/95 border-t border-[#1C1C1C] px-4 md:px-10 py-3.5 z-40 select-none shadow-[0_-8px_32px_rgba(0,0,0,0.92)] backdrop-blur-2xl transition-all">
          <nav className="max-w-4xl mx-auto flex items-center justify-around md:justify-center gap-1.5 md:gap-14 w-full">
            
            {/* 1. Home tab locator */}
            <button
              type="button"
              id="tab-btn-home"
              onClick={() => { setActiveTab('home'); }}
              className={`p-2.5 md:p-3 rounded-xl flex flex-col items-center justify-center transition-all ${
                activeTab === 'home'
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-950/20'
                  : 'text-gray-400 hover:text-white hover:bg-[#161616]'
              }`}
              title="Home: New Bots tray"
            >
              <Home size={18} />
              <span className="hidden md:inline text-[9px] font-bold mt-1 tracking-tight font-sans">Home</span>
            </button>

            {/* 2. Search tab locator */}
            <button
              type="button"
              id="tab-btn-search"
              onClick={() => { setActiveTab('search'); }}
              className={`p-2.5 md:p-3 rounded-xl flex flex-col items-center justify-center transition-all ${
                activeTab === 'search'
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-950/20'
                  : 'text-gray-400 hover:text-white hover:bg-[#161616]'
              }`}
              title="Search: Case/Space Insensitive Matcher"
            >
              <Search size={18} />
              <span className="hidden md:inline text-[9px] font-bold mt-1 tracking-tight font-sans">Search</span>
            </button>

            {/* 3. Link Paste Matrix Importer */}
            <button
              type="button"
              id="tab-btn-import"
              onClick={() => { setIsImportModalOpen(true); }}
              className={`p-2.5 md:p-3 rounded-xl flex flex-col items-center justify-center transition-all ${
                isImportModalOpen
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/20'
                  : 'text-gray-400 hover:text-white hover:bg-[#161616]'
              }`}
              title="Link Importer: Paste Chai or C.ai link"
            >
              <Link2 size={18} className={isImporting ? "animate-pulse text-rose-400" : ""} />
              <span className="hidden md:inline text-[9px] font-bold mt-1 tracking-tight font-sans">Import Link</span>
            </button>

            {/* 4. Create bot tab locator */}
            <button
              type="button"
              id="tab-btn-create"
              onClick={() => { setActiveTab('create'); }}
              className={`p-2.5 md:p-3 rounded-xl flex flex-col items-center justify-center transition-all ${
                activeTab === 'create'
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-950/20'
                  : 'text-gray-400 hover:text-white hover:bg-[#161616]'
              }`}
              title="Create: Persona Architect Tools"
            >
              <Plus size={18} />
              <span className="hidden md:inline text-[9px] font-bold mt-1 tracking-tight font-sans">Create</span>
            </button>

            {/* 5. Chat (Dialogue History) tab locator */}
            <button
              type="button"
              id="tab-btn-chat"
              onClick={() => { setActiveTab('chat_list'); }}
              className={`p-2.5 md:p-3 rounded-xl flex flex-col items-center justify-center transition-all relative ${
                activeTab === 'chat_list'
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-950/20'
                  : 'text-gray-400 hover:text-white hover:bg-[#161616]'
              }`}
              title="Chat: Active Dialogues list"
            >
              <MessageSquare size={18} />
              {activeChatSessions.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-violet-400 rounded-full border border-[#0D0D0D]" />
              )}
              <span className="hidden md:inline text-[9px] font-bold mt-1 tracking-tight font-sans">Chat</span>
            </button>

            {/* 6. Heart (Favorites tray) tab locator */}
            <button
              type="button"
              id="tab-btn-favorites"
              onClick={() => { setActiveTab('favorites'); }}
              className={`p-2.5 md:p-3 rounded-xl flex flex-col items-center justify-center transition-all relative ${
                activeTab === 'favorites'
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-950/20'
                  : 'text-gray-400 hover:text-white hover:bg-[#161616]'
              }`}
              title="Favorites matrix"
            >
              <Heart size={18} />
              {favoriteCharacters.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-[#0D0D0D]" />
              )}
              <span className="hidden md:inline text-[9px] font-bold mt-1 tracking-tight font-sans">Favorites</span>
            </button>

          </nav>
        </div>
      )}

      {/* --- GLOBAL CONFIRMATION DIALOG MODAL --- */}
      <AnimatePresence>
        {confirmModal.open && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 select-none">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0E0E0E] border border-rose-500/20 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative overflow-hidden text-center hover:scale-100"
            >
              {/* Dangerous red decorative outline */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600" />
              
              <div className="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
                <Trash2 size={22} className="animate-pulse" />
              </div>

              <h4 className="text-white font-bold text-base tracking-tight mb-2">
                {confirmModal.title}
              </h4>
              <p className="text-xs text-gray-400 leading-relaxed mb-6 font-sans">
                {confirmModal.message}
              </p>

              <div className="flex gap-3 justify-center font-sans">
                <button
                  type="button"
                  id="confirm-cancel-btn"
                  onClick={() => setConfirmModal({ open: false, title: '', message: '', onConfirm: () => {} })}
                  className="px-4 py-2.5 bg-[#161616] hover:bg-[#222] text-xs font-semibold text-gray-400 hover:text-white rounded-xl border border-[#262626] transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="confirm-proceed-btn"
                  onClick={() => {
                    confirmModal.onConfirm();
                    setConfirmModal({ open: false, title: '', message: '', onConfirm: () => {} });
                  }}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-750 text-white text-xs font-bold rounded-xl transition-all shadow-lg hover:shadow-rose-950/20 cursor-pointer"
                >
                  Delete and Clear
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- NEURAL MATRIX LINK IMPORTER MODAL --- */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4 select-none animate-fade-in">
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              className="bg-[#0E0E0E] border border-[#222] rounded-3xl p-6 max-w-md w-full shadow-3xl relative overflow-hidden text-left"
            >
              {/* Top gradient element */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-rose-600 animate-pulse" />

              <div className="flex items-center justify-between mb-5 font-sans">
                <div className="flex items-center gap-2">
                  <div className="bg-gradient-to-tr from-violet-500/10 to-rose-500/10 border border-violet-500/30 p-2 rounded-xl text-violet-400">
                    <Link2 size={18} className={isImporting ? "animate-spin" : ""} />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-base tracking-tight leading-normal">Neural Link Importer</h4>
                    <p className="text-[10px] text-gray-500 font-mono">Chai & Character.ai gateway</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setIsImportModalOpen(false); setImportError(null); }}
                  className="p-1.5 rounded-xl bg-[#161616] border border-[#262626] text-gray-400 hover:text-white transition-all cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={handleImportBot} className="space-y-4 font-sans">
                <div className="space-y-2">
                  <label htmlFor="import-url" className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Enter any bot URI or description links
                  </label>
                  <div className="relative">
                    <input
                      id="import-url"
                      type="text"
                      value={importLink}
                      onChange={(e) => setImportLink(e.target.value)}
                      placeholder="Paste e.g. https://beta.character.ai/chat?char=..."
                      disabled={isImporting}
                      className="w-full pl-4 pr-16 py-3.5 bg-[#111111] border border-[#262626] focus:border-violet-500 rounded-2xl text-xs text-white outline-none placeholder-gray-600 transition-all font-sans"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          if (text) setImportLink(text);
                        } catch (err) {
                          console.warn("Failed to read from clipboard", err);
                        }
                      }}
                      className="absolute right-2 top-2 px-2.5 py-1.5 rounded-lg bg-[#181818] border border-[#2F2F2F] text-gray-400 hover:text-neutral-200 text-[10px] uppercase font-mono font-bold transition-all"
                      title="Paste from clipboard"
                    >
                      Paste
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-normal">
                    Securely extracts the character directives, taglines, biographies, greeting frames, categories, and mature tags using server-side Gemini 3.5-Flash parsing. Bypass browser-side Cloudflare and CORS restriction mechanics.
                  </p>
                </div>

                {importError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-[11px] text-rose-400 leading-relaxed font-mono">
                    ⚠️ {importError}
                  </div>
                )}

                <div className="flex gap-3 justify-end pt-3 border-t border-[#1C1C1C]">
                  <button
                    type="button"
                    onClick={() => { setIsImportModalOpen(false); setImportError(null); }}
                    className="px-4 py-2 bg-[#161616] hover:bg-[#222] text-xs font-semibold text-gray-400 hover:text-white rounded-xl border border-[#262626] transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isImporting}
                    className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-violet-950/20 disabled:opacity-50"
                  >
                    {isImporting ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        Synchronizing...
                      </>
                    ) : (
                      <>
                        <Sparkles size={13} />
                        Import & Access
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
