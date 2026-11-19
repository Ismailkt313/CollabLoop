import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Paperclip,
  AtSign,
  FileText,
  Image as ImageIcon,
  Shield,
  User,
  Users,
  ChevronDown,
  Sparkles,
  ExternalLink,
  Smile,
  Hash,
  Bell,
  Mic,
  Square,
  Trash2,
  Loader2,
  Check,
  AlertCircle,
  Plus,
  Edit2,
  Copy,
  CornerDownRight,
  Search,
} from 'lucide-react';
import { projectSocket } from '../../services/projectSocket';
import { uploadChatAttachment } from '../../services/cloudinary';
import VoiceMessagePlayer from '../../components/VoiceMessagePlayer';
import FullscreenLightbox from '../../components/FullscreenLightbox';
import { buildApiUrl } from '../../services/apiConfig';

const api = async (path, options = {}) => {
  const response = await fetch(buildApiUrl(path), {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
};

const initials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || '?';

function formatBytes(bytes, decimals = 1) {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

let sharedAudioCtx = null;
function getAudioContext() {
  if (!sharedAudioCtx && typeof window !== 'undefined') {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export default function ProjectChatWidget({
  project,
  user,
  membership,
  targetChannelName = null,
  forceOpen = false,
  onCloseForce = () => {},
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [totalUnread, setTotalUnread] = useState(0);

  // Loading & Error states
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  // Input & Composer states
  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);

  // Mention Autocomplete
  const [projectMembers, setProjectMembers] = useState([]);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [stagedMentions, setStagedMentions] = useState([]);

  // Channel Dropdown & Management Modals
  const [showChannelDropdown, setShowChannelDropdown] = useState(false);
  const [channelSearch, setChannelSearch] = useState('');
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [channelModalMode, setChannelModalMode] = useState('create'); // 'create' | 'edit'
  const [channelFormName, setChannelFormName] = useState('');
  const [channelFormDesc, setChannelFormDesc] = useState('');
  const [editingChannel, setEditingChannel] = useState(null);
  const [channelModalError, setChannelModalError] = useState('');
  const [savingChannel, setSavingChannel] = useState(false);

  // Voice Note Recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const audioStreamRef = useRef(null);

  // Lightbox for previewing image attachments
  const [lightboxReference, setLightboxReference] = useState(null);

  // Typing indicators
  const [typingUsers, setTypingUsers] = useState(new Map());
  const typingTimeoutRef = useRef(null);

  // UI refs
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const projectId = project?._id || project?.id;
  const currentUserId = user?._id || user?.id;

  const isOwnerOrAdmin =
    membership?.projectRole === 'owner' ||
    membership?.projectRole === 'admin' ||
    project?.ownerId?._id === currentUserId ||
    project?.ownerId === currentUserId;

  // Audio notification chime
  const playChime = useCallback(() => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  }, []);

  // Handle forceOpen from parent
  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
      onCloseForce();
    }
  }, [forceOpen, onCloseForce]);

  // Load project members for @mentions autocomplete
  useEffect(() => {
    if (!projectId) return;
    api(`/projects/${projectId}/members`)
      .then((data) => {
        setProjectMembers(data.members || []);
      })
      .catch((err) => console.warn('Could not load members for mentions:', err));
  }, [projectId]);

  // Connect Socket and join project room
  useEffect(() => {
    if (!projectId) return;
    projectSocket.connect();
    projectSocket.joinProject(projectId);

    const handleChannelActivity = ({ channelId, senderId }) => {
      if (senderId !== currentUserId) {
        setChannels((prev) =>
          prev.map((ch) =>
            ch._id === channelId
              ? { ...ch, unreadCount: (ch.unreadCount || 0) + 1 }
              : ch
          )
        );
        setTotalUnread((t) => t + 1);
        if (!isOpen) {
          playChime();
        }
      }
    };

    const handleChannelCreated = (newChannel) => {
      setChannels((prev) => {
        if (prev.some((c) => c._id === newChannel._id)) return prev;
        return [...prev, { ...newChannel, unreadCount: 0 }];
      });
    };

    const handleChannelUpdated = (updated) => {
      setChannels((prev) =>
        prev.map((c) => (c._id === updated._id ? { ...c, ...updated } : c))
      );
      if (activeChannel?._id === updated._id) {
        setActiveChannel((a) => ({ ...a, ...updated }));
      }
    };

    const handleChannelDeleted = ({ channelId }) => {
      setChannels((prev) => prev.filter((c) => c._id !== channelId));
      if (activeChannel?._id === channelId) {
        setActiveChannel(null);
      }
    };

    const handleMentionNotification = ({ channelName }) => {
      playChime();
    };

    projectSocket.on('channel:activity', handleChannelActivity);
    projectSocket.on('channel:created', handleChannelCreated);
    projectSocket.on('channel:updated', handleChannelUpdated);
    projectSocket.on('channel:deleted', handleChannelDeleted);
    projectSocket.on('notification:mention', handleMentionNotification);

    return () => {
      projectSocket.off('channel:activity', handleChannelActivity);
      projectSocket.off('channel:created', handleChannelCreated);
      projectSocket.off('channel:updated', handleChannelUpdated);
      projectSocket.off('channel:deleted', handleChannelDeleted);
      projectSocket.off('notification:mention', handleMentionNotification);
      projectSocket.leaveProject(projectId);
    };
  }, [projectId, currentUserId, isOpen, activeChannel, playChime]);

  // Load project channels
  const fetchChannels = useCallback(async () => {
    if (!projectId) return;
    setLoadingChannels(true);
    try {
      const data = await api(`/projects/${projectId}/channels`);
      const chs = data.channels || [];
      setChannels(chs);

      const unreads = chs.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
      setTotalUnread(unreads);

      // Select active channel: targetChannelName > current active > #general > first
      if (chs.length > 0) {
        let selected = null;
        if (targetChannelName) {
          const cleanTarget = targetChannelName.replace(/^#/, '').toLowerCase();
          selected = chs.find((c) => c.name.toLowerCase() === cleanTarget);
        }
        if (!selected && activeChannel) {
          selected = chs.find((c) => c._id === activeChannel._id);
        }
        if (!selected) {
          selected = chs.find((c) => c.name === 'general') || chs[0];
        }
        setActiveChannel(selected);
      }
    } catch (err) {
      console.warn('Failed to load project channels:', err);
    } finally {
      setLoadingChannels(false);
    }
  }, [projectId, targetChannelName, activeChannel]);

  useEffect(() => {
    setActiveChannel(null);
    setMessages([]);
    setChannels([]);
    fetchChannels();
  }, [projectId]);

  // When active channel changes, load its messages and join channel room
  useEffect(() => {
    if (!projectId || !activeChannel) {
      setMessages([]);
      return;
    }

    const channelId = activeChannel._id;
    projectSocket.joinChannel(projectId, channelId);

    setLoadingMessages(true);
    setError('');
    api(`/projects/${projectId}/messages?channelId=${channelId}&limit=60`)
      .then((data) => {
        setMessages(data.messages || []);
        // Reset unread count for this channel
        setChannels((prev) =>
          prev.map((c) => (c._id === channelId ? { ...c, unreadCount: 0 } : c))
        );
        setTotalUnread((prev) => Math.max(0, prev - (activeChannel.unreadCount || 0)));
        projectSocket.markAsRead({ projectId, channelId });
      })
      .catch((err) => {
        setError(err.message || 'Failed to load messages');
      })
      .finally(() => {
        setLoadingMessages(false);
      });

    // Real-time message listeners
    const handleNewMessage = (newMsg) => {
      if (newMsg.channelId === channelId) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === newMsg._id)) return prev;
          return [...prev, newMsg];
        });
        projectSocket.markAsRead({ projectId, channelId });
        if (newMsg.senderId?._id !== currentUserId) {
          playChime();
        }
      }
    };

    const handleUpdatedMessage = (updated) => {
      if (updated.channelId === channelId) {
        setMessages((prev) =>
          prev.map((m) => (m._id === updated._id ? updated : m))
        );
      }
    };

    const handleDeletedMessage = ({ messageId, channelId: cId }) => {
      if (cId === channelId) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === messageId
              ? { ...m, isDeleted: true, text: 'This message was deleted', attachments: [] }
              : m
          )
        );
      }
    };

    const typingTimeouts = new Map();

    const handleTypingUser = ({ channelId: cId, userId: uId, name, username }) => {
      if (cId === channelId && uId !== currentUserId) {
        setTypingUsers((prev) => new Map(prev).set(uId, name || username));
        if (typingTimeouts.has(uId)) {
          clearTimeout(typingTimeouts.get(uId));
        }
        const timeoutId = setTimeout(() => {
          setTypingUsers((prev) => {
            const next = new Map(prev);
            next.delete(uId);
            return next;
          });
          typingTimeouts.delete(uId);
        }, 5000);
        typingTimeouts.set(uId, timeoutId);
      }
    };

    const handleTypingUserStopped = ({ channelId: cId, userId: uId }) => {
      if (cId === channelId) {
        if (typingTimeouts.has(uId)) {
          clearTimeout(typingTimeouts.get(uId));
          typingTimeouts.delete(uId);
        }
        setTypingUsers((prev) => {
          const next = new Map(prev);
          next.delete(uId);
          return next;
        });
      }
    };

    projectSocket.on('message:new', handleNewMessage);
    projectSocket.on('message:updated', handleUpdatedMessage);
    projectSocket.on('message:deleted', handleDeletedMessage);
    projectSocket.on('typing:user', handleTypingUser);
    projectSocket.on('typing:user_stopped', handleTypingUserStopped);

    return () => {
      typingTimeouts.forEach((tid) => clearTimeout(tid));
      typingTimeouts.clear();
      projectSocket.off('message:new', handleNewMessage);
      projectSocket.off('message:updated', handleUpdatedMessage);
      projectSocket.off('message:deleted', handleDeletedMessage);
      projectSocket.off('typing:user', handleTypingUser);
      projectSocket.off('typing:user_stopped', handleTypingUserStopped);
      projectSocket.leaveChannel(projectId, channelId);
    };
  }, [projectId, activeChannel, currentUserId, playChime]);

  // Auto-scroll to bottom of messages area
  useEffect(() => {
    if (messagesEndRef.current && isOpen) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Filtered channels in dropdown
  const filteredChannels = useMemo(() => {
    const q = channelSearch.trim().toLowerCase();
    if (!q) return channels;
    return channels.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [channels, channelSearch]);

  // Filtered members for @mentions
  const filteredMentionMembers = useMemo(() => {
    const q = mentionQuery.toLowerCase();
    return projectMembers.filter((m) => {
      const u = m.userId || {};
      const name = (u.name || '').toLowerCase();
      const username = (u.username || '').toLowerCase();
      return name.includes(q) || username.includes(q);
    });
  }, [projectMembers, mentionQuery]);

  // Handle Input Changes & @mention detection
  const handleInputChange = (e) => {
    const text = e.target.value;
    setInputText(text);

    // Typing socket event
    if (activeChannel) {
      projectSocket.startTyping({
        projectId,
        channelId: activeChannel._id,
        name: user.name,
        username: user.username,
      });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        projectSocket.stopTyping({ projectId, channelId: activeChannel._id });
      }, 2000);
    }

    // Check for @ trigger
    const cursor = e.target.selectionStart;
    const textBeforeCursor = text.slice(0, cursor);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');

    if (lastAtIdx !== -1) {
      const query = textBeforeCursor.slice(lastAtIdx + 1);
      if (!query.includes(' ') && query.length < 25) {
        setMentionQuery(query);
        setShowMentionMenu(true);
        return;
      }
    }
    setShowMentionMenu(false);
  };

  const handleSelectMention = (member) => {
    const u = member.userId || {};
    const mentionHandle = `@${u.username}`;

    const cursor = inputRef.current ? inputRef.current.selectionStart : inputText.length;
    const textBeforeCursor = inputText.slice(0, cursor);
    const textAfterCursor = inputText.slice(cursor);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');

    let newText = inputText;
    if (lastAtIdx !== -1) {
      newText = textBeforeCursor.slice(0, lastAtIdx) + mentionHandle + ' ' + textAfterCursor;
    } else {
      newText = inputText + (inputText.endsWith(' ') ? '' : ' ') + mentionHandle + ' ';
    }

    setInputText(newText);
    setStagedMentions((prev) => {
      if (prev.some((m) => m._id === u._id)) return prev;
      return [...prev, u];
    });
    setShowMentionMenu(false);
    if (inputRef.current) inputRef.current.focus();
  };

  // Attachment upload handler
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAttachment(true);
    try {
      const res = await uploadChatAttachment(file, { projectId, title: file.name });
      setAttachments((prev) => [
        ...prev,
        {
          type: res.resourceType || 'file',
          url: res.url,
          publicId: res.publicId,
          fileName: res.fileName || file.name,
          fileSize: res.fileSize || file.size,
          format: res.format,
          width: res.width,
          height: res.height,
        },
      ]);
    } catch (err) {
      alert(`Attachment upload failed: ${err.message}`);
    } finally {
      setIsUploadingAttachment(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Voice note recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      alert('Microphone access denied or unavailable.');
    }
  };

  const stopAndSendRecording = async () => {
    if (!mediaRecorderRef.current) return;

    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, {
        type: 'audio/webm',
      });

      // Stop stream tracks
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
      }

      setIsRecording(false);
      setIsUploadingVoice(true);

      try {
        const res = await uploadChatAttachment(audioFile, {
          projectId,
          title: `Voice Message (${recordingSeconds}s)`,
        });

        // Send voice message directly
        await projectSocket.sendMessage({
          projectId,
          channelId: activeChannel._id,
          text: '',
          messageType: 'voice',
          attachments: [
            {
              type: 'voice',
              url: res.url,
              publicId: res.publicId,
              fileName: 'Voice Message',
              duration: recordingSeconds,
              format: 'webm',
            },
          ],
        });
      } catch (err) {
        alert(`Voice message upload failed: ${err.message}`);
      } finally {
        setIsUploadingVoice(false);
      }
    };

    mediaRecorderRef.current.stop();
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    setIsRecording(false);
    audioChunksRef.current = [];
  };

  // Send message
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!activeChannel || (!inputText.trim() && attachments.length === 0)) return;

    // If currently editing a message
    if (editingMessage) {
      try {
        setSending(true);
        await projectSocket.editMessage({
          projectId,
          channelId: activeChannel._id,
          messageId: editingMessage._id,
          text: inputText.trim(),
        });
        setEditingMessage(null);
        setInputText('');
      } catch (err) {
        alert(err.message || 'Failed to edit message');
      } finally {
        setSending(false);
      }
      return;
    }

    setSending(true);
    try {
      const mentionIds = stagedMentions.map((m) => m._id);

      await projectSocket.sendMessage({
        projectId,
        channelId: activeChannel._id,
        text: inputText.trim(),
        attachments,
        mentions: mentionIds,
        replyTo: replyingTo?._id || null,
        messageType: attachments.length > 0 ? 'file' : 'text',
      });

      setInputText('');
      setAttachments([]);
      setStagedMentions([]);
      setReplyingTo(null);
    } catch (err) {
      alert(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Delete message handler
  const handleDeleteMessage = async (msg) => {
    if (!window.confirm('Delete this message permanently?')) return;
    try {
      await projectSocket.deleteMessage({
        projectId,
        channelId: activeChannel._id,
        messageId: msg._id,
      });
    } catch (err) {
      alert(err.message || 'Could not delete message');
    }
  };

  // Channel Creation / Update Form Handler
  const handleSaveChannel = async (e) => {
    e.preventDefault();
    if (!channelFormName.trim()) return;

    setSavingChannel(true);
    setChannelModalError('');

    try {
      if (channelModalMode === 'create') {
        const data = await api(`/projects/${projectId}/channels`, {
          method: 'POST',
          body: JSON.stringify({
            name: channelFormName.trim(),
            description: channelFormDesc.trim(),
          }),
        });
        setShowChannelModal(false);
        setActiveChannel(data.channel);
      } else if (channelModalMode === 'edit' && editingChannel) {
        const data = await api(`/projects/${projectId}/channels/${editingChannel._id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: channelFormName.trim(),
            description: channelFormDesc.trim(),
          }),
        });
        setShowChannelModal(false);
        setActiveChannel(data.channel);
      }
    } catch (err) {
      setChannelModalError(err.message || 'Failed to save channel');
    } finally {
      setSavingChannel(false);
    }
  };

  const handleDeleteChannel = async (channelToDelete) => {
    if (channelToDelete.isDefault || channelToDelete.name === 'general') {
      alert('The default general channel cannot be deleted.');
      return;
    }
    if (!window.confirm(`Delete channel #${channelToDelete.name} and all its messages?`)) return;

    try {
      await api(`/projects/${projectId}/channels/${channelToDelete._id}`, {
        method: 'DELETE',
      });
    } catch (err) {
      alert(err.message || 'Failed to delete channel');
    }
  };

  const typingNames = Array.from(typingUsers.values());

  return (
    <>
      {/* ── 1. Floating "Ask Doubts" Trigger Button ───────────────────── */}
      {!isOpen && (
        <button
          type="button"
          className="collabs-chat-fab-trigger"
          onClick={() => setIsOpen(true)}
          aria-label="Open project discussion chat"
          title="Open Project Q&A and Team Discussions"
        >
          <div className="fab-icon-wrapper">
            <MessageSquare size={17} />
            <span className="fab-online-dot" />
          </div>
          <span className="fab-label">Ask Doubts</span>
          {totalUnread > 0 && (
            <span className="fab-unread-counter-badge">{totalUnread}</span>
          )}
        </button>
      )}

      {/* ── 2. Floating Chat Drawer Panel ─────────────────────────────── */}
      {isOpen && (
        <div className="collabs-chat-drawer-container" role="dialog" aria-modal="true">
          {/* Header */}
          <div className="chat-drawer-header">
            {/* Channel Switcher */}
            <div className="header-room-select-group">
              <button
                type="button"
                className="room-picker-toggle-btn"
                onClick={() => setShowChannelDropdown((p) => !p)}
                title="Select discussion channel"
              >
                <Hash size={15} className="room-hash-icon" />
                <span>{activeChannel ? activeChannel.name : 'Select Channel'}</span>
                <ChevronDown
                  size={14}
                  className={`chevron-icon ${showChannelDropdown ? 'rotated' : ''}`}
                />
              </button>

              {/* Channel Dropdown Menu */}
              {showChannelDropdown && (
                <div className="chat-room-dropdown-menu">
                  <div className="chat-dropdown-search-wrap">
                    <Search size={13} className="search-icon-mini" />
                    <input
                      type="text"
                      value={channelSearch}
                      onChange={(e) => setChannelSearch(e.target.value)}
                      placeholder="Search channels..."
                      className="chat-dropdown-search-input"
                    />
                  </div>

                  <div className="dropdown-section-title">
                    <span>PROJECT CHANNELS ({filteredChannels.length})</span>
                    {isOwnerOrAdmin && (
                      <button
                        type="button"
                        className="btn-add-channel-mini"
                        onClick={() => {
                          setShowChannelDropdown(false);
                          setChannelModalMode('create');
                          setChannelFormName('');
                          setChannelFormDesc('');
                          setShowChannelModal(true);
                        }}
                        title="Create new channel"
                      >
                        <Plus size={12} />
                        <span>Add</span>
                      </button>
                    )}
                  </div>

                  <div className="dropdown-channels-scroll">
                    {filteredChannels.map((ch) => {
                      const isSelected = activeChannel?._id === ch._id;
                      return (
                        <div
                          key={ch._id}
                          className={`dropdown-room-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => {
                            setActiveChannel(ch);
                            setShowChannelDropdown(false);
                          }}
                        >
                          <Hash size={14} className="ch-hash" />
                          <div className="dropdown-room-info">
                            <div className="room-name-row">
                              <span className="dropdown-room-name">{ch.name}</span>
                              {ch.unreadCount > 0 && (
                                <span className="ch-unread-pill">{ch.unreadCount}</span>
                              )}
                            </div>
                            {ch.description && (
                              <span className="dropdown-room-desc">{ch.description}</span>
                            )}
                          </div>

                          {/* Owner/Admin management controls */}
                          {isOwnerOrAdmin && !ch.isDefault && ch.name !== 'general' && (
                            <div
                              className="dropdown-ch-actions"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                className="ch-action-icon"
                                title="Edit channel"
                                onClick={() => {
                                  setShowChannelDropdown(false);
                                  setChannelModalMode('edit');
                                  setEditingChannel(ch);
                                  setChannelFormName(ch.name);
                                  setChannelFormDesc(ch.description || '');
                                  setShowChannelModal(true);
                                }}
                              >
                                <Edit2 size={11} />
                              </button>
                              <button
                                type="button"
                                className="ch-action-icon delete"
                                title="Delete channel"
                                onClick={() => handleDeleteChannel(ch)}
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* User Pill & Close Action */}
            <div className="header-actions-group">
              <div
                className="chat-profile-pill-btn"
                title={`${user.name} (@${user.username})`}
              >
                {user.avatar ? (
                  <img src={user.avatar} alt="" className="chat-profile-avatar" />
                ) : (
                  <span className="chat-profile-fallback">
                    {initials(user.name || user.username)}
                  </span>
                )}
                <span className="profile-pill-name">@{user.username}</span>
              </div>

              <button
                type="button"
                className="chat-close-btn"
                onClick={() => setIsOpen(false)}
                title="Close chat"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Channel Description Banner */}
          {activeChannel?.description && (
            <div className="chat-channel-subbar">
              <span>{activeChannel.description}</span>
            </div>
          )}

          {/* ── Messages Feed ────────────────────────────────────────── */}
          <div className="chat-messages-scroll-area">
            {loadingMessages ? (
              <div className="chat-loading-box">
                <Loader2 size={24} className="spin-animation" />
                <span>Loading discussion...</span>
              </div>
            ) : error ? (
              <div className="chat-error-box">
                <AlertCircle size={20} />
                <span>{error}</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="chat-empty-state">
                <Sparkles size={28} className="empty-sparkle-icon" />
                <h4 className="empty-title">Welcome to #{activeChannel?.name || 'chat'}!</h4>
                <p className="empty-subtitle">
                  Ask questions, share technical updates, or discuss implementation details with your team.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = String(msg.senderId?._id || msg.senderId?.id || msg.senderId) === String(currentUserId);
                const sender = msg.senderId || {};
                const formattedTime = msg.createdAt
                  ? new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '';

                return (
                  <div
                    key={msg._id}
                    className={`chat-message-row ${isMe ? 'own-message' : ''} ${msg.isDeleted ? 'deleted-msg' : ''}`}
                  >
                    {!isMe && (
                      <div className="message-avatar-indicator">
                        {sender.avatar ? (
                          <img src={sender.avatar} alt="" />
                        ) : (
                          <span>{initials(sender.name || sender.username)}</span>
                        )}
                      </div>
                    )}

                    <div className="message-content-bundle">
                      <div className="message-meta-header">
                        <span className="sender-name">{sender.name || 'Member'}</span>
                        <span className="sender-username">@{sender.username}</span>
                        <span className="message-time">{formattedTime}</span>
                        {msg.isEdited && !msg.isDeleted && (
                          <span className="message-edited-tag">(edited)</span>
                        )}
                      </div>

                      {/* Replying Context Banner */}
                      {msg.replyTo && (
                        <div className="message-reply-preview-chip">
                          <CornerDownRight size={11} />
                          <span>
                            <b>@{msg.replyTo.senderId?.username || 'member'}:</b>{' '}
                            {msg.replyTo.text || 'Attachment'}
                          </span>
                        </div>
                      )}

                      {/* Message Bubble Body */}
                      <div className="message-bubble-body">
                        {msg.isDeleted ? (
                          <em className="msg-deleted-text">This message was deleted</em>
                        ) : (
                          <>
                            {/* Voice Message */}
                            {msg.messageType === 'voice' && msg.attachments?.[0] ? (
                              <VoiceMessagePlayer
                                audioUrl={msg.attachments[0].url}
                                duration={msg.attachments[0].duration || 0}
                                isMe={isMe}
                              />
                            ) : null}

                            {/* Regular Text */}
                            {msg.text && (
                              <p className="message-text">
                                {msg.text.split(/(@[a-zA-Z0-9_-]+)/g).map((chunk, i) => {
                                  if (chunk.startsWith('@')) {
                                    return (
                                      <span key={i} className="mention-highlight">
                                        {chunk}
                                      </span>
                                    );
                                  }
                                  return chunk;
                                })}
                              </p>
                            )}

                            {/* Attachments */}
                            {msg.attachments && msg.attachments.length > 0 && msg.messageType !== 'voice' && (
                              <div className="message-attachments-strip">
                                {msg.attachments.map((att, i) => {
                                  if (att.type === 'image' || att.url?.match(/\.(png|jpe?g|webp|gif|svg)$/i)) {
                                    return (
                                      <div
                                        key={i}
                                        className="chat-attachment-thumb"
                                        onClick={() =>
                                          setLightboxReference({
                                            id: msg._id,
                                            imageUrl: att.url,
                                            title: att.fileName || msg.text || 'Image Attachment',
                                          })
                                        }
                                      >
                                        <img src={att.url} alt="" loading="lazy" />
                                      </div>
                                    );
                                  }
                                  return (
                                    <a
                                      key={i}
                                      href={att.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      download={att.fileName}
                                      className="chat-attachment-doc-chip"
                                    >
                                      <FileText size={14} className="doc-chip-icon" />
                                      <span className="doc-chip-name">{att.fileName || 'Document'}</span>
                                      {att.fileSize ? (
                                        <span className="doc-chip-size">{formatBytes(att.fileSize)}</span>
                                      ) : null}
                                    </a>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        )}

                        {/* Hover Message Action Icons */}
                        {!msg.isDeleted && (
                          <div className="message-action-hover-menu">
                            <button
                              type="button"
                              className="msg-action-btn"
                              title="Reply"
                              onClick={() => setReplyingTo(msg)}
                            >
                              <CornerDownRight size={12} />
                            </button>
                            <button
                              type="button"
                              className="msg-action-btn"
                              title="Copy Text"
                              onClick={() => {
                                navigator.clipboard?.writeText(msg.text);
                              }}
                            >
                              <Copy size={12} />
                            </button>
                            {isMe && (
                              <button
                                type="button"
                                className="msg-action-btn"
                                title="Edit"
                                onClick={() => {
                                  setEditingMessage(msg);
                                  setInputText(msg.text);
                                  inputRef.current?.focus();
                                }}
                              >
                                <Edit2 size={12} />
                              </button>
                            )}
                            {(isMe || isOwnerOrAdmin) && (
                              <button
                                type="button"
                                className="msg-action-btn delete"
                                title="Delete"
                                onClick={() => handleDeleteMessage(msg)}
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Typing Indicator */}
            {typingNames.length > 0 && (
              <div className="chat-typing-indicator-row">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-text">
                  {typingNames.join(', ')} {typingNames.length === 1 ? 'is' : 'are'} typing...
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Mention Autocomplete Popup ────────────────────────────── */}
          {showMentionMenu && filteredMentionMembers.length > 0 && (
            <div className="chat-mention-autocomplete-menu">
              <div className="dropdown-section-title">PROJECT CONTRIBUTORS</div>
              <div className="mention-items-list">
                {filteredMentionMembers.map((m) => {
                  const u = m.userId || {};
                  return (
                    <button
                      key={m._id}
                      type="button"
                      className="mention-item-row"
                      onClick={() => handleSelectMention(m)}
                    >
                      <div className="mention-avatar-mini">
                        {u.avatar ? (
                          <img src={u.avatar} alt="" />
                        ) : (
                          <span>{initials(u.name || u.username)}</span>
                        )}
                      </div>
                      <div className="mention-row-text">
                        <span className="mention-item-name">{u.name}</span>
                        <span className="mention-item-detail">
                          @{u.username} · {m.teamFunction || 'Member'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Replying Context Banner ─────────────────────────────────── */}
          {replyingTo && (
            <div className="chat-composer-context-bar">
              <div className="composer-context-text">
                <CornerDownRight size={12} />
                <span>
                  Replying to <b>@{replyingTo.senderId?.username}</b>
                </span>
              </div>
              <button
                type="button"
                className="btn-cancel-context"
                onClick={() => setReplyingTo(null)}
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* ── Editing Context Banner ──────────────────────────────────── */}
          {editingMessage && (
            <div className="chat-composer-context-bar edit">
              <div className="composer-context-text">
                <Edit2 size={12} />
                <span>Editing your message</span>
              </div>
              <button
                type="button"
                className="btn-cancel-context"
                onClick={() => {
                  setEditingMessage(null);
                  setInputText('');
                }}
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* ── Staged Attachments Preview Strip ───────────────────────── */}
          {attachments.length > 0 && (
            <div className="chat-staged-attachments-strip">
              {attachments.map((att, idx) => (
                <div key={idx} className="staged-att-item">
                  <span className="staged-att-name">{att.fileName}</span>
                  <button
                    type="button"
                    className="staged-att-remove"
                    onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── Voice Recording Dock ────────────────────────────────────── */}
          {isRecording ? (
            <div className="chat-voice-recording-dock">
              <div className="recording-indicator">
                <span className="rec-pulse-dot" />
                <span className="rec-timer">
                  Recording audio... {Math.floor(recordingSeconds / 60)}:
                  {(recordingSeconds % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <div className="recording-actions">
                <button
                  type="button"
                  className="btn-voice-cancel"
                  onClick={cancelRecording}
                  title="Cancel recording"
                >
                  <Trash2 size={15} />
                  <span>Cancel</span>
                </button>
                <button
                  type="button"
                  className="btn-voice-send"
                  onClick={stopAndSendRecording}
                  title="Finish and send voice message"
                >
                  <Send size={15} />
                  <span>Send</span>
                </button>
              </div>
            </div>
          ) : (
            /* ── Composer Footer Form ──────────────────────────────────── */
            <form onSubmit={handleSendMessage} className="chat-input-footer-form">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.docx,.txt,.md"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />

              <div className="input-toolbar-left">
                <button
                  type="button"
                  className="chat-tool-btn"
                  title="Attach Image or Document"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAttachment || sending}
                >
                  {isUploadingAttachment ? (
                    <Loader2 size={16} className="spin-animation" />
                  ) : (
                    <Paperclip size={16} />
                  )}
                </button>

                <button
                  type="button"
                  className="chat-tool-btn"
                  title="Mention Member (@)"
                  onClick={() => {
                    setInputText((p) => p + '@');
                    setMentionQuery('');
                    setShowMentionMenu(true);
                    inputRef.current?.focus();
                  }}
                >
                  <AtSign size={16} />
                </button>

                <button
                  type="button"
                  className="chat-tool-btn"
                  title="Record Voice Note"
                  onClick={startRecording}
                  disabled={isUploadingVoice || sending}
                >
                  {isUploadingVoice ? (
                    <Loader2 size={16} className="spin-animation" />
                  ) : (
                    <Mic size={16} />
                  )}
                </button>
              </div>

              <textarea
                ref={inputRef}
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={
                  activeChannel ? `Message #${activeChannel.name}...` : 'Write a message...'
                }
                rows={1}
                className="chat-textarea-input"
                disabled={sending}
              />

              <button
                type="submit"
                className="chat-send-submit-btn"
                disabled={(!inputText.trim() && attachments.length === 0) || sending}
                title="Send Message (Enter)"
              >
                {sending ? (
                  <Loader2 size={16} className="spin-animation" />
                ) : (
                  <Send size={16} />
                )}
              </button>
            </form>
          )}
        </div>
      )}

      {/* ── 3. Channel Management Modal (Create / Edit) ────────────────── */}
      {showChannelModal && (
        <div
          className="rw-modal-overlay"
          onClick={() => !savingChannel && setShowChannelModal(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="rw-modal-card rw-confirm-card" onClick={(e) => e.stopPropagation()}>
            <div className="rw-modal-header">
              <h3 className="rw-modal-title">
                {channelModalMode === 'create' ? 'Create Discussion Channel' : 'Edit Channel'}
              </h3>
              <button
                type="button"
                className="rw-modal-close-btn"
                onClick={() => setShowChannelModal(false)}
                disabled={savingChannel}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveChannel} className="rw-modal-body">
              {channelModalError && (
                <div className="rw-modal-alert error" role="alert">
                  <AlertCircle size={15} />
                  <span>{channelModalError}</span>
                </div>
              )}

              <div className="rw-form-group">
                <label htmlFor="ch-name">
                  Channel Name <span className="rw-required">*</span>
                </label>
                <div className="rw-input-prefix-wrap">
                  <span className="rw-input-prefix">#</span>
                  <input
                    id="ch-name"
                    type="text"
                    value={channelFormName}
                    onChange={(e) => setChannelFormName(e.target.value)}
                    placeholder="e.g. backend-help or qa-testing"
                    className="rw-input"
                    required
                    disabled={
                      savingChannel ||
                      (channelModalMode === 'edit' && editingChannel?.isDefault)
                    }
                  />
                </div>
              </div>

              <div className="rw-form-group">
                <label htmlFor="ch-desc">Description (Optional)</label>
                <textarea
                  id="ch-desc"
                  rows={3}
                  value={channelFormDesc}
                  onChange={(e) => setChannelFormDesc(e.target.value)}
                  placeholder="What is this channel for?"
                  className="rw-textarea"
                  disabled={savingChannel}
                />
              </div>

              <div className="rw-modal-footer">
                <button
                  type="button"
                  className="rw-btn-secondary"
                  onClick={() => setShowChannelModal(false)}
                  disabled={savingChannel}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rw-btn-primary"
                  disabled={!channelFormName.trim() || savingChannel}
                >
                  {savingChannel ? (
                    <>
                      <Loader2 size={14} className="spin-animation" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{channelModalMode === 'create' ? 'Create Channel' : 'Save Changes'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 4. Fullscreen Lightbox for Chat Image Previews ─────────────── */}
      {lightboxReference && (
        <FullscreenLightbox
          reference={lightboxReference}
          allCategoryReferences={[lightboxReference]}
          onClose={() => setLightboxReference(null)}
        />
      )}
    </>
  );
}
