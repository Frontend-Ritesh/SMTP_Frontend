import React, { useState, useEffect, useRef } from 'react';
import { 
  Inbox, Send, FileText, ShieldAlert, Bell, Users, Mail,
  Search, RefreshCw, Trash2, Edit, LogOut, ShieldAlert as AdminIcon,
  Paperclip, X, ChevronRight, User, Calendar, Plus, ChevronLeft,
  Star, MoreVertical, ChevronDown, ShieldOff, ShieldCheck, Reply
} from 'lucide-react';
import { request } from '../api/client';

const RichTextEditor = ({ value, onChange, placeholder, id }) => {
  const editorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const executeCommand = (command, val = null) => {
    document.execCommand(command, false, val);
    handleInput();
  };

  return (
    <div style={styles.rteContainer}>
      <div style={styles.rteToolbar}>
        <button type="button" style={styles.rteToolbarBtn} onClick={() => executeCommand('bold')} title="Bold">
          <b>B</b>
        </button>
        <button type="button" style={styles.rteToolbarBtn} onClick={() => executeCommand('italic')} title="Italic">
          <i>I</i>
        </button>
        <button type="button" style={styles.rteToolbarBtn} onClick={() => executeCommand('underline')} title="Underline">
          <u>U</u>
        </button>
        <div style={styles.rteDivider}></div>
        <button type="button" style={styles.rteToolbarBtn} onClick={() => executeCommand('insertUnorderedList')} title="Bullet List">
          • List
        </button>
        <button type="button" style={styles.rteToolbarBtn} onClick={() => executeCommand('insertOrderedList')} title="Numbered List">
          1. List
        </button>
      </div>
      <div
        id={id}
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        placeholder={placeholder}
        style={styles.rteEditor}
      />
    </div>
  );
};

export default function WebmailView({ user, onLogout, onNavigateToAdmin, onNavigateToTenant }) {
  const [folders, setFolders] = useState(['INBOX', 'Sent', 'Drafts', 'Spam', 'Notifications', 'Social']);
  const [activeFolder, setActiveFolder] = useState('INBOX');
  const [spamReporting, setSpamReporting] = useState(false);
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [messageDetails, setMessageDetails] = useState(null);
  const [expandedMessages, setExpandedMessages] = useState({});
  const [selectedUids, setSelectedUids] = useState({});
  const [starredUids, setStarredUids] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState(null);
  const [syncingMailbox, setSyncingMailbox] = useState(false);

  const [replyType, setReplyType] = useState(null);
  const [replyBody, setReplyBody] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [replyAttachments, setReplyAttachments] = useState([]);
  const [replySending, setReplySending] = useState(false);
  const [draftId, setDraftId] = useState(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const [showCompose, setShowCompose] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeCc, setComposeCc] = useState('');
  const [composeBcc, setComposeBcc] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [sending, setSending] = useState(false);

  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  const [avatar, setAvatar] = useState(user.avatar || null);

  const handleAvatarClick = () => {
    if (avatarInputRef.current) {
      avatarInputRef.current.click();
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const max_size = 128;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > max_size) {
            height *= max_size / width;
            width = max_size;
          }
        } else {
          if (height > max_size) {
            width *= max_size / height;
            height = max_size;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

        uploadAvatar(dataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const uploadAvatar = async (dataUrl) => {
    try {
      const res = await request('/api/mailbox/avatar/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: dataUrl })
      });
      if (res.status === 'success') {
        setAvatar(dataUrl);
        alert('Profile picture updated successfully!');
      } else {
        alert('Failed to update profile picture.');
      }
    } catch (err) {
      alert('Error uploading avatar: ' + err.message);
    }
  };

  // Fetch Folders
  useEffect(() => {
    async function loadFolders() {
      try {
        const res = await request('/api/folders/');
        if (res.folders && res.folders.length > 0) {
          // Normalize folders (e.g. capitalize INBOX and merge with defaults)
          const fetched = res.folders.map(f => f === 'INBOX' ? 'INBOX' : f);
          const combined = Array.from(new Set(['INBOX', 'Starred', 'Sent', 'Drafts', 'Spam', ...fetched]));
          setFolders(combined);
        }
      } catch (err) {
        console.error('Error fetching folders:', err);
      }
    }
    loadFolders();
  }, []);

  // Fetch Message List
  const fetchMessages = async (folderName, sync = true) => {
    setLoadingList(true);
    if (sync && folderName.toLowerCase() !== 'starred') setSyncingMailbox(true);
    try {
      const url = folderName.toLowerCase() === 'starred'
        ? '/api/messages/starred/'
        : `/api/messages/?folder=${encodeURIComponent(folderName)}`;
      const res = await request(url);
      const msgList = res.results || res || [];
      setMessages(msgList);
      
      // Sync starred state from database
      const initialStarred = {};
      msgList.forEach(m => {
        if (m.flagged) {
          initialStarred[m.uid] = true;
        }
      });
      setStarredUids(prev => ({ ...prev, ...initialStarred }));
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoadingList(false);
      setSyncingMailbox(false);
    }
  };

  useEffect(() => {
    if (!searchQuery) {
      fetchMessages(activeFolder, true);
    }
  }, [activeFolder, searchQuery]);

  // Handle Search
  const handleSearch = async (e) => {
    e.preventDefault();
    setCurrentPage(1);
    setSelectedUids({});
    if (!searchQuery.trim()) {
      fetchMessages(activeFolder, false);
      return;
    }
    setIsSearching(true);
    setLoadingList(true);
    try {
      const res = await request(`/api/search/?q=${encodeURIComponent(searchQuery)}`);
      setMessages(res.results || res || []);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoadingList(false);
      setIsSearching(false);
    }
  };

  // View Message Details
  const handleSelectMessage = async (msg) => {
    setSelectedMessage(msg);
    setLoadingDetails(true);
    setMessageDetails(null);
    setDetailsError(null);
    try {
      const res = await request(`/api/messages/${encodeURIComponent(msg.folder)}/${msg.uid}/`);
      setMessageDetails(res);
      setExpandedMessages({ [`${msg.folder}-${msg.uid}`]: true });
      // Mark as seen locally
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, seen: true } : m));
    } catch (err) {
      console.error('Failed to fetch message details:', err);
      setDetailsError(err.message || String(err));
    } finally {
      setLoadingDetails(false);
    }
  };

  // Delete Message
  const handleDeleteMessage = async (msg) => {
    if (!window.confirm('Are you sure you want to delete this email?')) return;
    try {
      await request(`/api/messages/${encodeURIComponent(msg.folder)}/${msg.uid}/`, {
        method: 'DELETE',
      });
      // Remove from state
      setMessages(prev => prev.filter(m => m.uid !== msg.uid || m.folder !== msg.folder));
      if (selectedMessage && selectedMessage.uid === msg.uid && selectedMessage.folder === msg.folder) {
        setSelectedMessage(null);
        setMessageDetails(null);
      }
    } catch (err) {
      alert('Failed to delete email: ' + err.message);
    }
  };

  // Spam / Ham reporting — trains rspamd Bayesian filter
  const handleSpamReport = async (msg, action) => {
    if (!msg) return;
    setSpamReporting(true);
    try {
      await request('/api/spam-report/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: msg.folder, uid: msg.uid, action }),
      });
      // Remove the message from the current list and close reader
      setMessages(prev => prev.filter(m => m.uid !== msg.uid || m.folder !== msg.folder));
      setSelectedMessage(null);
      setMessageDetails(null);
      const label = action === 'spam' ? 'marked as spam' : 'moved to Inbox';
      // Brief toast-like notification via title flash
      const origTitle = document.title;
      document.title = `✅ Message ${label}`;
      setTimeout(() => { document.title = origTitle; }, 2500);
    } catch (err) {
      alert(`Failed to report as ${action}: ${err.message}`);
    } finally {
      setSpamReporting(false);
    }
  };

  // Send Message
  const handleSend = async (e) => {
    e.preventDefault();
    if (!composeTo.trim()) {
      alert('Recipient is required');
      return;
    }
    setSending(true);

    try {
      let bodyData;
      let headers = {};

      if (attachments.length > 0) {
        bodyData = new FormData();
        bodyData.append('to', composeTo);
        if (composeCc.trim()) bodyData.append('cc', composeCc);
        if (composeBcc.trim()) bodyData.append('bcc', composeBcc);
        bodyData.append('subject', composeSubject);
        bodyData.append('body', composeBody);
        if (draftId) bodyData.append('draft_id', draftId);
        attachments.forEach((file) => {
          bodyData.append('attachments', file);
        });
      } else {
        headers['Content-Type'] = 'application/json';
        bodyData = JSON.stringify({
          to: composeTo.split(',').map(email => email.trim()).filter(Boolean),
          cc: composeCc.trim() ? composeCc.split(',').map(email => email.trim()).filter(Boolean) : undefined,
          bcc: composeBcc.trim() ? composeBcc.split(',').map(email => email.trim()).filter(Boolean) : undefined,
          subject: composeSubject,
          body: composeBody,
          draft_id: draftId || undefined
        });
      }

      await request('/api/send/', {
        method: 'POST',
        headers,
        body: bodyData,
      });

      alert('Message sent successfully!');
      setShowCompose(false);
      setComposeTo('');
      setComposeCc('');
      setComposeBcc('');
      setComposeSubject('');
      setComposeBody('');
      setAttachments([]);
      setDraftId(null);
      
      // Refresh Sent box if active
      if (activeFolder === 'Sent') {
        fetchMessages('Sent', true);
      }
    } catch (err) {
      alert('Failed to send: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  // Handle Logout
  const handleLogoutClick = async () => {
    try {
      await request('/api/auth/logout/', { method: 'POST' });
      onLogout();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const getFolderIcon = (name) => {
    switch (name.toLowerCase()) {
      case 'inbox': return <Inbox size={18} />;
      case 'sent': return <Send size={18} />;
      case 'drafts': return <FileText size={18} />;
      case 'spam': return <ShieldAlert size={18} />;
      case 'notifications': return <Bell size={18} />;
      case 'social': return <Users size={18} />;
      default: return <Mail size={18} />;
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const toggleSelectRow = (e, msg) => {
    e.stopPropagation();
    const groupUids = msg._groupUids || [msg.uid];
    const isAnySelected = groupUids.some(uid => selectedUids[uid]);
    setSelectedUids(prev => {
      const next = { ...prev };
      groupUids.forEach(uid => {
        next[uid] = !isAnySelected;
      });
      return next;
    });
  };

  const toggleStarRow = async (e, msg) => {
    e.stopPropagation();
    const nextStarredState = !starredUids[msg.uid];
    
    // Optimistic update
    setStarredUids(prev => ({ ...prev, [msg.uid]: nextStarredState }));
    
    try {
      await request('/api/messages/bulk-action/', {
        method: 'POST',
        body: JSON.stringify({
          uids: [msg.uid],
          folder: msg.folder || activeFolder,
          action: nextStarredState ? 'star' : 'unstar'
        })
      });
      if (activeFolder.toLowerCase() === 'starred' && !nextStarredState) {
        setMessages(prev => prev.filter(m => m.uid !== msg.uid));
      }
    } catch (err) {
      console.error('Failed to update star state on server:', err);
      // Rollback
      setStarredUids(prev => ({ ...prev, [msg.uid]: !nextStarredState }));
      alert('Failed to update star: ' + err.message);
    }
  };

  const handleBulkAction = async (action) => {
    const selectedList = Object.keys(selectedUids)
      .filter(uid => selectedUids[uid])
      .map(Number);
      
    if (selectedList.length === 0) return;
    
    if (action === 'delete') {
      if (!window.confirm(`Are you sure you want to delete ${selectedList.length} selected emails?`)) return;
    }
    
    setLoadingList(true);
    try {
      await request('/api/messages/bulk-action/', {
        method: 'POST',
        body: JSON.stringify({
          uids: selectedList,
          folder: activeFolder,
          action: action
        })
      });
      
      if (action === 'delete') {
        setMessages(prev => prev.filter(m => !selectedUids[m.uid]));
        if (selectedMessage && selectedUids[selectedMessage.uid]) {
          setSelectedMessage(null);
          setMessageDetails(null);
        }
      } else if (action === 'read') {
        setMessages(prev => prev.map(m => selectedUids[m.uid] ? { ...m, seen: true } : m));
      } else if (action === 'unread') {
        setMessages(prev => prev.map(m => selectedUids[m.uid] ? { ...m, seen: false } : m));
      }
      
      setSelectedUids({});
    } catch (err) {
      alert(`Failed to perform bulk ${action}: ` + err.message);
    } finally {
      setLoadingList(false);
    }
  };

  const getReplyRecipient = (msgDetails) => {
    if (!msgDetails) return '';
    const thread = msgDetails.thread || [];
    const lastMsg = thread.length > 0 ? thread[thread.length - 1] : msgDetails;
    
    const cleanEmail = (emailStr) => {
      if (!emailStr) return '';
      const match = emailStr.match(/<([^>]+)>/);
      return match ? match[1].trim() : emailStr.trim();
    };

    const senderEmail = lastMsg.sender_email || cleanEmail(lastMsg.from);
    const myEmail = user.mailbox ? user.mailbox.toLowerCase().trim() : '';
    
    if (senderEmail.toLowerCase().trim() === myEmail) {
      const toField = lastMsg.to || [];
      const recipients = Array.isArray(toField) ? toField : [toField];
      const otherRecipients = recipients
        .map(r => cleanEmail(r).toLowerCase().trim())
        .filter(r => r && r !== myEmail);
      if (otherRecipients.length > 0) {
        const matched = recipients.find(r => cleanEmail(r).toLowerCase().trim() === otherRecipients[0]);
        return matched || otherRecipients[0];
      }
      return lastMsg.from || senderEmail;
    }
    return lastMsg.from || senderEmail;
  };

  const initiateReply = (type) => {
    setReplyType(type);
    setReplyBody('');
    setReplyAttachments([]);
    if (type === 'reply' || type === 'reply_all') {
      setReplyTo(getReplyRecipient(messageDetails));
    } else {
      setReplyTo('');
    }
  };
 
  const handleSendReply = async (e) => {
    e.preventDefault();
    let toRecipient = replyTo;
    if (replyType === 'reply' || replyType === 'reply_all') {
      toRecipient = getReplyRecipient(messageDetails);
    }
    
    if (!toRecipient.trim()) {
      alert('Recipient is required');
      return;
    }
    
    setReplySending(true);
    try {
      let bodyData;
      let headers = {};
      
      const parsedCc = [];
      if (replyType === 'reply_all') {
        const thread = messageDetails.thread || [];
        const lastMsg = thread.length > 0 ? thread[thread.length - 1] : messageDetails;
        const toField = lastMsg.to || [];
        const toList = Array.isArray(toField) ? toField : [toField];
        
        const cleanEmail = (emailStr) => {
          if (!emailStr) return '';
          const match = emailStr.match(/<([^>]+)>/);
          return match ? match[1].trim() : emailStr.trim();
        };
        
        const myEmail = user.mailbox ? user.mailbox.toLowerCase().trim() : '';
        const cleanToRecipient = cleanEmail(toRecipient).toLowerCase().trim();
        
        toList.forEach(email => {
          const cleanR = cleanEmail(email).toLowerCase().trim();
          if (cleanR !== myEmail && cleanR !== cleanToRecipient) {
            parsedCc.push(email);
          }
        });
      }

      if (replyAttachments.length > 0) {
        bodyData = new FormData();
        bodyData.append('to', toRecipient);
        bodyData.append('subject', replyType === 'forward' ? `Fwd: ${messageDetails.subject}` : `Re: ${messageDetails.subject}`);
        bodyData.append('body', replyBody);
        bodyData.append('in_reply_to', messageDetails.message_id || '');
        bodyData.append('references', messageDetails.references || messageDetails.message_id || '');
        if (parsedCc.length > 0) {
          bodyData.append('cc', parsedCc.join(','));
        }
        replyAttachments.forEach(file => {
          bodyData.append('attachments', file);
        });
      } else {
        headers['Content-Type'] = 'application/json';
        bodyData = JSON.stringify({
          to: toRecipient.split(',').map(email => email.trim()).filter(Boolean),
          subject: replyType === 'forward' ? `Fwd: ${messageDetails.subject}` : `Re: ${messageDetails.subject}`,
          body: replyBody,
          in_reply_to: messageDetails.message_id || undefined,
          references: messageDetails.references || messageDetails.message_id || undefined,
          cc: parsedCc.length > 0 ? parsedCc.map(email => email.trim()).filter(Boolean) : undefined
        });
      }
      
      await request('/api/send/', {
        method: 'POST',
        headers,
        body: bodyData,
      });
      
      alert('Reply sent successfully!');
      setReplyType(null);
      setReplyBody('');
      setReplyAttachments([]);
      setReplyTo('');
    } catch (err) {
      alert('Failed to send reply: ' + err.message);
    } finally {
      setReplySending(false);
    }
  };

  // Drafts Auto-Save Effect
  useEffect(() => {
    if (!showCompose) {
      setDraftId(null);
      return;
    }
    
    // Don't auto-save if everything is empty
    if (!composeTo.trim() && !composeCc.trim() && !composeBcc.trim() && !composeSubject.trim() && !composeBody.trim()) {
      return;
    }
    
    const delayDebounce = setTimeout(async () => {
      setIsSavingDraft(true);
      try {
        const res = await request('/api/drafts/', {
          method: 'POST',
          body: JSON.stringify({
            to: composeTo,
            cc: composeCc,
            bcc: composeBcc,
            subject: composeSubject,
            body: composeBody,
            message_id: draftId
          })
        });
        if (res.message_id) {
          setDraftId(res.message_id);
        }
      } catch (err) {
        console.error('Draft auto-save failed:', err);
      } finally {
        setIsSavingDraft(false);
      }
    }, 2500);
    
    return () => clearTimeout(delayDebounce);
  }, [composeTo, composeCc, composeBcc, composeSubject, composeBody, showCompose]);

  // Deduplicate messages in a thread
  const getDeduplicatedThread = (details) => {
    if (!details) return [];
    if (!details.thread) return [details];
    
    // Filter out drafts if they are not the target message
    const filteredDrafts = details.thread.filter(t => {
      return !(t.folder && t.folder.toLowerCase() === 'drafts' && !t.is_target);
    });

    const seen = new Set();
    // Prioritize target message in deduplication check by processing it or placing it in seen first
    const target = filteredDrafts.find(t => t.is_target);
    if (target) {
      if (target.message_id) seen.add(target.message_id.trim());
      seen.add(`${target.folder}-${target.uid}`);
    }

    return filteredDrafts.filter(t => {
      if (t.is_target) return true; // target is already added and kept
      
      const folderUidKey = `${t.folder}-${t.uid}`;
      if (seen.has(folderUidKey)) return false;
      
      const msgIdKey = t.message_id ? t.message_id.trim() : null;
      if (msgIdKey) {
        if (seen.has(msgIdKey)) return false;
        seen.add(msgIdKey);
      }
      
      seen.add(folderUidKey);
      return true;
    });
  };

  // Group messages by conversation_id
  const getGroupedMessages = (msgList) => {
    const groups = {};
    const ungrouped = [];

    msgList.forEach(m => {
      if (m.conversation_id) {
        if (!groups[m.conversation_id]) {
          groups[m.conversation_id] = [];
        }
        groups[m.conversation_id].push(m);
      } else {
        ungrouped.push(m);
      }
    });

    const groupedList = [];

    // For each conversation group, create a single representative message
    Object.keys(groups).forEach(convId => {
      const groupMsgs = groups[convId];
      // Sort messages in group by date descending to find the latest
      groupMsgs.sort((a, b) => new Date(b.date) - new Date(a.date));
      const latest = groupMsgs[0];
      
      const count = groupMsgs.length;
      const anyUnread = groupMsgs.some(m => !m.seen);
      const anyFlagged = groupMsgs.some(m => m.flagged);
      
      // Build display sender string from all senders in the conversation thread
      const senders = [];
      groupMsgs.slice().reverse().forEach(m => {
        let display = m.from_addr;
        if (m.from_addr.includes('<')) {
          const match = m.from_addr.match(/^(.*?)\s*</);
          if (match && match[1]) {
            display = match[1].replace(/['"]/g, '').trim();
          }
        }
        if (!senders.includes(display)) {
          senders.push(display);
        }
      });
      
      groupedList.push({
        ...latest,
        _isGroup: true,
        _count: count,
        _senders: senders.join(', '),
        seen: !anyUnread,
        flagged: anyFlagged,
        _groupUids: groupMsgs.map(m => m.uid)
      });
    });

    ungrouped.forEach(m => {
      groupedList.push({
        ...m,
        _isGroup: false,
        _count: 1,
        _senders: m.from_addr,
        _groupUids: [m.uid]
      });
    });

    // Sort the entire list by the latest message's date descending
    groupedList.sort((a, b) => new Date(b.date) - new Date(a.date));
    return groupedList;
  };

  const processedMessages = getGroupedMessages(messages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const paginatedMessages = processedMessages.slice(startIndex, endIndex);
  const startRange = processedMessages.length === 0 ? 0 : startIndex + 1;
  const endRange = Math.min(endIndex, processedMessages.length);
  const totalCount = processedMessages.length;

  return (
    <div style={styles.appContainer}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={styles.logoContainer}>
            <Mail size={24} color="var(--color-primary)" />
          </div>
          <div>
            <div style={styles.logoText}>Micronet Mail</div>
            <div style={styles.activeMailbox}>{user.mailbox || 'No Mailbox'}</div>
          </div>
        </div>

        <button style={styles.composeBtn} onClick={() => setShowCompose(true)}>
          <Plus size={20} color="var(--color-primary)" />
          <span>Compose</span>
        </button>

        <nav style={styles.nav}>
          <div style={styles.sectionHeader}>Folders</div>
          <ul style={styles.folderList}>
            {folders.map((folder) => (
              <li key={folder}>
                <button
                  style={{
                    ...styles.folderItem,
                    backgroundColor: activeFolder === folder ? 'var(--color-primary-soft)' : 'transparent',
                    color: activeFolder === folder ? 'var(--color-primary)' : 'var(--text-secondary)',
                    fontWeight: activeFolder === folder ? '700' : '500',
                  }}
                  onClick={() => {
                    setActiveFolder(folder);
                    setSelectedMessage(null);
                    setMessageDetails(null);
                    setSearchQuery('');
                    setCurrentPage(1);
                    setSelectedUids({});
                  }}
                >
                  <span style={{ marginRight: '12px', display: 'flex', alignItems: 'center' }}>
                    {getFolderIcon(folder)}
                  </span>
                  <span>{folder === 'INBOX' ? 'Inbox' : folder}</span>
                </button>
              </li>
            ))}
          </ul>

          {user.is_staff && (
            <>
              <div style={styles.sectionHeader}>Administration</div>
              <button style={styles.adminLink} onClick={onNavigateToAdmin}>
                <AdminIcon size={18} style={{ marginRight: '12px' }} />
                <span>Admin Control Panel</span>
              </button>
            </>
          )}

          <>
            <div style={styles.sectionHeader}>Workspace</div>
            <button style={styles.tenantLink} onClick={onNavigateToTenant}>
              <Users size={18} style={{ marginRight: '12px' }} />
              <span>Manage Workspace</span>
            </button>
          </>
        </nav>

        <div style={styles.sidebarFooter}>
          <div 
            style={{ ...styles.userInfo, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }} 
            onClick={handleAvatarClick}
            title="Click to change profile picture"
          >
            {avatar ? (
              <img src={avatar} style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} alt="Avatar" />
            ) : (
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-primary-soft)',
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '600',
                fontSize: '0.8rem'
              }}>
                {user.username ? user.username[0].toUpperCase() : 'U'}
              </div>
            )}
            <span style={styles.username}>{user.username}</span>
          </div>
          <input 
            type="file" 
            ref={avatarInputRef} 
            style={{ display: 'none' }} 
            accept="image/*" 
            onChange={handleAvatarChange} 
          />
          <button style={styles.logoutBtn} onClick={handleLogoutClick} title="Logout">
            <LogOut size={16} style={{ marginRight: '8px' }} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={styles.mainContent}>
        {/* Top Header */}
        <header style={styles.topHeader}>
          <form onSubmit={handleSearch} style={styles.searchForm}>
            <Search size={18} style={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search mail..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              style={{
                ...styles.searchInput,
                backgroundColor: isSearchFocused ? '#ffffff' : 'var(--bg-tertiary)',
                boxShadow: isSearchFocused ? '0 1px 3px rgba(60,64,67,0.3)' : 'none',
              }}
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} style={styles.clearSearch}>
                <X size={16} />
              </button>
            )}
          </form>
        </header>

        {/* Split View */}
        <div style={styles.splitView}>
          {/* Email List Column */}
          <section style={{
            ...styles.listPane,
            width: selectedMessage ? '40%' : '100%',
          }}>
            {/* Action Sub-Header */}
            <div style={styles.listActionBar}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="checkbox"
                    checked={paginatedMessages.length > 0 && paginatedMessages.every(m => m._groupUids ? m._groupUids.every(uid => selectedUids[uid]) : selectedUids[m.uid])}
                    onChange={(e) => {
                      const allSelected = paginatedMessages.every(m => m._groupUids ? m._groupUids.every(uid => selectedUids[uid]) : selectedUids[m.uid]);
                      if (allSelected) {
                        setSelectedUids({});
                      } else {
                        const nextSelected = { ...selectedUids };
                        paginatedMessages.forEach(m => {
                          const uids = m._groupUids || [m.uid];
                          uids.forEach(uid => {
                            nextSelected[uid] = true;
                          });
                        });
                        setSelectedUids(nextSelected);
                      }
                    }}
                    style={styles.actionCheckbox}
                  />
                  <ChevronDown size={14} style={{ color: 'var(--text-secondary)', cursor: 'pointer' }} />
                </div>
                
                {Object.values(selectedUids).filter(Boolean).length > 0 ? (
                  <>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
                      {Object.values(selectedUids).filter(Boolean).length} selected
                    </span>
                    <button
                      type="button"
                      className="action-bar-btn"
                      onClick={() => handleBulkAction('delete')}
                      title="Delete selected"
                    >
                      <Trash2 size={16} />
                    </button>
                    <button
                      type="button"
                      className="action-bar-btn"
                      onClick={() => handleBulkAction('read')}
                      title="Mark as read"
                    >
                      <Mail size={16} />
                    </button>
                    <button
                      type="button"
                      className="action-bar-btn"
                      onClick={() => handleBulkAction('unread')}
                      title="Mark as unread"
                    >
                      <Mail size={16} style={{ opacity: 0.6 }} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="action-bar-btn"
                      onClick={() => fetchMessages(activeFolder, true)}
                      disabled={loadingList || syncingMailbox}
                      title="Refresh"
                    >
                      <RefreshCw size={16} className={syncingMailbox ? 'animate-spin' : ''} />
                    </button>

                    <button className="action-bar-btn" title="More">
                      <MoreVertical size={16} />
                    </button>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={styles.paginationText}>
                  {startRange}-{endRange} of {totalCount}
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    className="pagination-btn"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    title="Older"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    className="pagination-btn"
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    disabled={endRange >= totalCount}
                    title="Newer"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            {loadingList && messages.length === 0 ? (
              <div style={styles.centerBox}>
                <RefreshCw size={24} className="animate-spin" color="var(--color-primary)" />
                <p style={{ marginTop: '10px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Syncing mailbox...
                </p>
              </div>
            ) : messages.length === 0 ? (
              <div style={styles.centerBox}>
                <Mail size={32} color="var(--text-muted)" />
                <p style={{ marginTop: '10px', color: 'var(--text-secondary)' }}>No messages found.</p>
              </div>
            ) : (
              <div style={styles.messageListScroll}>
                {paginatedMessages.map((msg) => (
                  <div
                    key={msg.id || `${msg.folder}-${msg.uid}`}
                    style={{
                      ...styles.msgCard,
                      backgroundColor: selectedMessage && selectedMessage.uid === msg.uid && selectedMessage.folder === msg.folder
                        ? 'var(--color-primary-soft)' 
                        : (!msg.seen ? '#f2f6fc' : '#ffffff'),
                      borderBottom: '1px solid var(--bg-tertiary)',
                    }}
                    onClick={() => handleSelectMessage(msg)}
                  >
                    <div style={styles.msgHeader}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', width: '75%' }}>
                        <input
                          type="checkbox"
                          checked={msg._groupUids ? msg._groupUids.every(uid => selectedUids[uid]) : !!selectedUids[msg.uid]}
                          onChange={(e) => toggleSelectRow(e, msg)}
                          style={styles.actionCheckbox}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={(e) => toggleStarRow(e, msg)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            color: starredUids[msg.uid] || msg.flagged ? '#f1c40f' : 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: 0,
                            border: 'none',
                            backgroundColor: 'transparent'
                          }}
                        >
                          <Star size={16} fill={starredUids[msg.uid] || msg.flagged ? '#f1c40f' : 'transparent'} />
                        </button>
                        {!msg.seen && (
                          <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--color-primary)',
                            flexShrink: 0
                          }} />
                        )}
                        <span style={{
                          ...styles.msgFrom,
                          fontWeight: !msg.seen ? '700' : '500',
                        }}>{msg._senders || msg.from_addr}</span>
                      </div>
                      <span style={styles.msgDate}>{formatDate(msg.date)}</span>
                    </div>
                    <div style={{
                      ...styles.msgSubject,
                      fontWeight: !msg.seen ? '700' : '400',
                    }}>
                      {msg.subject || '(No Subject)'}
                      {msg._count > 1 && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: '5px' }}>
                          ({msg._count})
                        </span>
                      )}
                    </div>
                    <div style={styles.msgSnippet}>{msg.snippet}</div>
                    <div style={styles.msgActions}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {msg.has_attachments && (
                          <Paperclip size={14} style={{ color: 'var(--text-secondary)' }} title="Has attachments" />
                        )}
                        <span style={styles.msgSize}>{formatSize(msg.size)}</span>
                      </div>
                      <button 
                        style={styles.deleteActionBtn} 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteMessage(msg);
                        }}
                        title="Delete email"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Email Details Column */}
          <section style={{
            ...styles.detailPane,
            display: selectedMessage ? 'flex' : 'none',
          }}>
            {loadingDetails ? (
              <div style={styles.centerBox}>
                <RefreshCw size={24} className="animate-spin" color="var(--color-primary)" />
                <p style={{ marginTop: '10px', fontSize: '0.875rem' }}>Loading message content...</p>
              </div>
            ) : detailsError ? (
              <div style={styles.centerBox}>
                <ShieldAlert size={36} color="var(--color-danger)" />
                <p style={{ marginTop: '10px', color: 'var(--color-danger)', fontWeight: '600' }}>
                  Failed to load email
                </p>
                <p style={{ marginTop: '5px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {detailsError}
                </p>
              </div>
            ) : messageDetails ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Reader Action Toolbar */}
                <div style={styles.detailToolbar}>
                  <button 
                    style={styles.toolbarBtn} 
                    onClick={() => { setSelectedMessage(null); setMessageDetails(null); }}
                    title="Back to list"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <div style={styles.toolbarDivider}></div>
                  <button 
                    style={styles.toolbarBtn} 
                    onClick={() => handleDeleteMessage(selectedMessage)}
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                  <div style={styles.toolbarDivider}></div>
                  {/* Spam / Not Spam reporting buttons */}
                  {activeFolder.toLowerCase() !== 'junk' && activeFolder.toLowerCase() !== 'spam' ? (
                    <button
                      style={{ ...styles.toolbarBtn, ...styles.spamBtn }}
                      onClick={() => handleSpamReport(selectedMessage, 'spam')}
                      disabled={spamReporting}
                      title="Mark as Spam"
                    >
                      <ShieldOff size={17} />
                      <span style={{ marginLeft: '5px', fontSize: '0.8rem' }}>Spam</span>
                    </button>
                  ) : (
                    <button
                      style={{ ...styles.toolbarBtn, ...styles.notSpamBtn }}
                      onClick={() => handleSpamReport(selectedMessage, 'ham')}
                      disabled={spamReporting}
                      title="Not Spam"
                    >
                      <ShieldCheck size={17} />
                      <span style={{ marginLeft: '5px', fontSize: '0.8rem' }}>Not Spam</span>
                    </button>
                  )}
                </div>

                <div style={styles.detailBodyContainer}>
                  <h2 style={styles.detailSubject}>{messageDetails.subject || '(No Subject)'}</h2>
                  
                  <div style={styles.threadContainer}>
                    {getDeduplicatedThread(messageDetails).map((t, index) => {
                      const isExpanded = expandedMessages[`${t.folder}-${t.uid}`] || t.is_target;
                      return (
                        <div key={`${t.folder}-${t.uid}`} style={styles.threadCard}>
                          {/* Header row */}
                          <div 
                            style={styles.threadCardHeader}
                            className="thread-card-header"
                            onClick={() => setExpandedMessages(prev => ({
                              ...prev,
                              [`${t.folder}-${t.uid}`]: !prev[`${t.folder}-${t.uid}`]
                            }))}
                          >
                            {t.sender_avatar ? (
                              <img 
                                src={t.sender_avatar} 
                                style={{
                                  width: '40px',
                                  height: '40px',
                                  borderRadius: '50%',
                                  objectFit: 'cover',
                                  flexShrink: 0
                                }} 
                                alt="Sender Avatar" 
                              />
                            ) : (
                              <div style={styles.senderAvatar}>
                                {t.sender_name ? t.sender_name[0].toUpperCase() : 'M'}
                              </div>
                            )}
                            {isExpanded ? (
                              <div style={{ flex: 1, overflow: 'hidden' }}>
                                <div style={styles.senderNameRow}>
                                  <span style={styles.senderName}>
                                    {t.sender_name || t.from}
                                    <span style={styles.senderEmail}> &lt;{t.sender_email || t.from}&gt;</span>
                                  </span>
                                  <span style={styles.senderDate}>{formatDate(t.date)}</span>
                                </div>
                                <div style={styles.recipientRow}>
                                  to {Array.isArray(t.to) ? t.to.join(', ') : t.to}
                                </div>
                              </div>
                            ) : (
                              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1, marginRight: '16px' }}>
                                  <span style={styles.senderName}>{t.sender_name || t.from}</span>
                                  <span style={{
                                    fontSize: '0.825rem',
                                    color: 'var(--text-secondary)',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    flex: 1
                                  }}>
                                    {t.text ? t.text.trim().slice(0, 120) : '(No Content)'}
                                  </span>
                                </div>
                                <span style={styles.senderDate}>{formatDate(t.date)}</span>
                              </div>
                            )}
                          </div>

                          {/* Body content (visible only if expanded) */}
                          {isExpanded && (
                            <div style={styles.threadCardBody}>
                              {t.attachments && t.attachments.length > 0 && (
                                <div style={styles.attachmentsContainer}>
                                  <div style={styles.attachmentsTitle}>
                                    <Paperclip size={14} style={{ marginRight: '6px' }} />
                                    <span>{t.attachments.length} Attachment{t.attachments.length > 1 ? 's' : ''}</span>
                                  </div>
                                  <div style={styles.attachmentsList}>
                                    {t.attachments.map((att, idx) => (
                                      <a
                                        key={idx}
                                        href={`/api/messages/${encodeURIComponent(t.folder)}/${t.uid}/attachments/${idx}/`}
                                        download={att.filename}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={styles.attachmentItem}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <Paperclip size={12} style={{ marginRight: '6px', flexShrink: 0 }} />
                                        <span style={styles.attachmentName}>{att.filename}</span>
                                        <span style={styles.attachmentSize}>({formatSize(att.size)})</span>
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div style={styles.messageBody}>
                                {t.html ? (
                                  <iframe
                                    title={`Email Body ${t.uid}`}
                                    srcDoc={`
                                      <html>
                                        <head>
                                          <base target="_blank">
                                          <style>
                                            body {
                                              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                                              color: #202124;
                                              line-height: 1.6;
                                              margin: 0;
                                              padding: 10px;
                                              background-color: transparent;
                                            }
                                          </style>
                                        </head>
                                        <body>
                                          ${t.html}
                                        </body>
                                      </html>
                                    `}
                                    style={{
                                      width: '100%',
                                      height: '250px',
                                      border: 'none',
                                      backgroundColor: 'transparent',
                                    }}
                                    sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                                    onLoad={(e) => {
                                      try {
                                        const iframe = e.target;
                                        if (iframe && iframe.contentWindow && iframe.contentWindow.document.body) {
                                          iframe.style.height = (iframe.contentWindow.document.body.scrollHeight + 20) + 'px';
                                        }
                                      } catch (err) {
                                        console.error(err);
                                      }
                                    }}
                                  />
                                ) : (
                                  <div style={{ whiteSpace: 'pre-wrap' }}>
                                    {t.text || '(No Content)'}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* Quick Reply Toolbar at the bottom of the details view */}
                {!replyType ? (
                  <div style={{ display: 'flex', gap: '10px', padding: '1.5rem', borderTop: '1px solid var(--glass-border)', backgroundColor: 'var(--bg-secondary)' }}>
                    <button
                      type="button"
                      style={styles.replyToolbarBtn}
                      onClick={() => initiateReply('reply')}
                    >
                      <Reply size={16} style={{ marginRight: '6px' }} />
                      <span>Reply</span>
                    </button>
                    <button
                      type="button"
                      style={styles.replyToolbarBtn}
                      onClick={() => initiateReply('reply_all')}
                    >
                      <Users size={16} style={{ marginRight: '6px' }} />
                      <span>Reply All</span>
                    </button>
                    <button
                      type="button"
                      style={styles.replyToolbarBtn}
                      onClick={() => initiateReply('forward')}
                    >
                      <Send size={16} style={{ marginRight: '6px', transform: 'rotate(-45deg)' }} />
                      <span>Forward</span>
                    </button>
                  </div>
                ) : (
                  <div style={styles.quickReplyContainer}>
                    <div style={styles.quickReplyHeader}>
                      <span style={{ fontWeight: '600', textTransform: 'capitalize', color: 'var(--text-primary)' }}>
                        {replyType.replace('_', ' ')}
                      </span>
                      <button type="button" style={styles.closeReplyBtn} onClick={() => setReplyType(null)}>
                        <X size={16} />
                      </button>
                    </div>
                    
                    <form onSubmit={handleSendReply} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {replyType === 'forward' && (
                        <div style={styles.composeInputRow}>
                          <span style={styles.composeInputLabel}>To</span>
                          <input
                            type="text"
                            value={replyTo}
                            onChange={(e) => setReplyTo(e.target.value)}
                            style={styles.composeInput}
                            required
                            placeholder="Recipient email address"
                          />
                        </div>
                      )}
                      
                      <div style={styles.composeBodyWrapper}>
                        <RichTextEditor
                          id="reply-body-editor"
                          placeholder="Type your reply here..."
                          value={replyBody}
                          onChange={setReplyBody}
                        />
                      </div>

                      {replyAttachments.length > 0 && (
                        <div style={styles.composeFileList}>
                          {replyAttachments.map((file, index) => (
                            <div key={index} style={styles.composeFileItem}>
                              <Paperclip size={12} style={{ marginRight: '6px' }} />
                              <span style={{ flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                 {file.name}
                              </span>
                              <button 
                                type="button" 
                                onClick={() => setReplyAttachments(prev => prev.filter((_, i) => i !== index))}
                                style={styles.removeFileBtn}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={styles.composeFooter}>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button 
                            type="button" 
                            style={styles.attachBtn} 
                            onClick={() => fileInputRef.current.click()}
                          >
                            <Paperclip size={18} style={{ marginRight: '6px' }} />
                            <span>Attach Files</span>
                          </button>
                        </div>

                        <button type="submit" style={styles.sendBtn} disabled={replySending}>
                          {replySending ? <RefreshCw size={16} className="animate-spin" /> : 'Send'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            ) : (
              <div style={styles.centerBox}>
                <Mail size={36} color="var(--text-muted)" />
                <p style={{ marginTop: '10px' }}>Select an email to view its content.</p>
              </div>
          )}
          </section>
        </div>
      </main>

      {/* Floating Compose Widget */}
      {showCompose && (
        <div style={styles.composeWindow} className="animate-fade">
          <div style={styles.composeWindowHeader}>
            <span style={styles.composeTitle}>New Message</span>
            <button style={styles.closeCompose} onClick={() => setShowCompose(false)}>
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSend} style={styles.composeForm}>
            <div style={styles.composeInputRow}>
              <span style={styles.composeInputLabel}>To</span>
              <input
                type="text"
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                style={styles.composeInput}
                required
              />
            </div>

            <div style={styles.composeInputRow}>
              <span style={styles.composeInputLabel}>Cc</span>
              <input
                type="text"
                value={composeCc}
                onChange={(e) => setComposeCc(e.target.value)}
                style={styles.composeInput}
              />
            </div>

            <div style={styles.composeInputRow}>
              <span style={styles.composeInputLabel}>Bcc</span>
              <input
                type="text"
                value={composeBcc}
                onChange={(e) => setComposeBcc(e.target.value)}
                style={styles.composeInput}
              />
            </div>

            <div style={styles.composeInputRow}>
              <span style={styles.composeInputLabel}>Subject</span>
              <input
                type="text"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                style={styles.composeInput}
              />
            </div>

            <div style={styles.composeBodyWrapper}>
              <RichTextEditor
                id="compose-body-editor"
                placeholder="Write your email here..."
                value={composeBody}
                onChange={setComposeBody}
              />
            </div>

            {attachments.length > 0 && (
              <div style={styles.composeFileList}>
                {attachments.map((file, index) => (
                  <div key={index} style={styles.composeFileItem}>
                    <Paperclip size={12} style={{ marginRight: '6px' }} />
                    <span style={{ flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                       {file.name}
                    </span>
                    <button 
                      type="button" 
                      onClick={() => setAttachments(prev => prev.filter((_, i) => i !== index))}
                      style={styles.removeFileBtn}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={styles.composeFooter}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  type="button" 
                  style={styles.attachBtn} 
                  onClick={() => fileInputRef.current.click()}
                >
                  <Paperclip size={18} style={{ marginRight: '6px' }} />
                  <span>Attach Files</span>
                </button>
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files) {
                      setAttachments(prev => [...prev, ...Array.from(e.target.files)]);
                    }
                  }}
                  style={{ display: 'none' }}
                />
              </div>

              <button type="submit" style={styles.sendBtn} disabled={sending}>
                {sending ? <RefreshCw size={16} className="animate-spin" /> : 'Send'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const styles = {
  appContainer: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
  },
  sidebar: {
    width: '260px',
    backgroundColor: 'var(--bg-secondary)',
    borderRight: '1px solid var(--glass-border)',
    display: 'flex',
    flexDirection: 'column',
    padding: '1.5rem 0 1.5rem 0',
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '0 1.5rem',
    marginBottom: '1.5rem',
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--color-primary-soft)',
    border: '1px solid rgba(26, 115, 232, 0.2)',
  },
  logoText: {
    fontFamily: 'var(--font-display)',
    fontWeight: '800',
    fontSize: '1.25rem',
    color: 'var(--text-primary)',
  },
  activeMailbox: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    maxWidth: '160px',
    whiteSpace: 'nowrap',
  },
  composeBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.75rem 1.5rem',
    backgroundColor: '#ffffff',
    color: 'var(--color-primary)',
    borderRadius: '24px',
    fontWeight: '700',
    fontSize: '0.95rem',
    border: '1px solid var(--glass-border)',
    boxShadow: '0 1px 2px 0 rgba(60, 64, 67, 0.3), 0 1px 3px 1px rgba(60, 64, 67, 0.15)',
    margin: '0 1.5rem 1.5rem 1.5rem',
    transition: 'all var(--transition-fast)',
    width: 'fit-content',
    gap: '8px',
    cursor: 'pointer',
    ':hover': {
      boxShadow: '0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15)',
    },
  },
  nav: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  sectionHeader: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    margin: '1rem 0 0.5rem 1.5rem',
  },
  folderList: {
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  folderItem: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    padding: '0.5rem 1rem 0.5rem 1.5rem',
    borderRadius: '0 16px 16px 0',
    fontSize: '0.9rem',
    transition: 'all var(--transition-fast)',
    textAlign: 'left',
    border: 'none',
    cursor: 'pointer',
  },
  adminLink: {
    width: 'calc(100% - 1.5rem)',
    display: 'flex',
    alignItems: 'center',
    padding: '0.6rem 0.75rem 0.6rem 1.5rem',
    borderRadius: '0 16px 16px 0',
    color: 'var(--color-warning)',
    backgroundColor: 'var(--color-warning-soft)',
    border: 'none',
    fontSize: '0.9rem',
    fontWeight: '600',
    textAlign: 'left',
    transition: 'opacity var(--transition-fast)',
    cursor: 'pointer',
  },
  tenantLink: {
    width: 'calc(100% - 1.5rem)',
    display: 'flex',
    alignItems: 'center',
    padding: '0.6rem 0.75rem 0.6rem 1.5rem',
    borderRadius: '0 16px 16px 0',
    color: 'var(--color-primary)',
    backgroundColor: 'var(--color-primary-soft)',
    border: 'none',
    fontSize: '0.9rem',
    fontWeight: '600',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'opacity var(--transition-fast)',
  },
  sidebarFooter: {
    marginTop: 'auto',
    borderTop: '1px solid var(--glass-border)',
    paddingTop: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    paddingLeft: '1.5rem',
    paddingRight: '1.5rem',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
  },
  username: {
    fontSize: '0.85rem',
    color: 'var(--text-primary)',
    fontWeight: '500',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '0.5rem 0.75rem',
    color: 'var(--color-danger)',
    backgroundColor: 'var(--color-danger-soft)',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
    width: '100%',
    justifyContent: 'center',
  },
  mainContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--bg-primary)',
  },
  topHeader: {
    height: '64px',
    borderBottom: '1px solid var(--glass-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 1.5rem',
    backgroundColor: 'var(--bg-primary)',
  },
  searchForm: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    maxWidth: '600px',
  },
  searchIcon: {
    position: 'absolute',
    left: '16px',
    color: 'var(--text-secondary)',
  },
  searchInput: {
    width: '100%',
    padding: '0.6rem 2.5rem 0.6rem 48px',
    backgroundColor: 'var(--bg-tertiary)',
    border: 'none',
    borderRadius: '24px',
    color: 'var(--text-primary)',
    fontSize: '0.95rem',
    transition: 'background-color var(--transition-fast), box-shadow var(--transition-fast)',
  },
  clearSearch: {
    position: 'absolute',
    right: '16px',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  refreshBtn: {
    padding: '0.5rem',
    borderRadius: '50%',
    border: 'none',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    width: '40px',
    height: '40px',
    transition: 'background-color var(--transition-fast)',
    ':hover': {
      backgroundColor: 'var(--bg-tertiary)',
    },
  },
  splitView: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  listPane: {
    borderRight: '1px solid var(--glass-border)',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    transition: 'width var(--transition-normal)',
    backgroundColor: 'var(--bg-primary)',
  },
  messageListScroll: {
    display: 'flex',
    flexDirection: 'column',
  },
  centerBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 2rem',
    textAlign: 'center',
    color: 'var(--text-secondary)',
    flex: 1,
  },
  msgCard: {
    padding: '1rem 1.5rem',
    borderBottom: '1px solid var(--bg-tertiary)',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.3rem',
    position: 'relative',
    ':hover': {
      backgroundColor: 'var(--bg-secondary)',
    },
  },
  msgHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.8rem',
  },
  msgFrom: {
    color: 'var(--text-primary)',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  },
  msgDate: {
    color: 'var(--text-secondary)',
    fontSize: '0.75rem',
  },
  msgSubject: {
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  },
  msgSnippet: {
    fontSize: '0.825rem',
    color: 'var(--text-secondary)',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    maxWidth: '100%',
  },
  msgActions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '0.2rem',
  },
  msgSize: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  deleteActionBtn: {
    color: 'var(--text-muted)',
    cursor: 'pointer',
    border: 'none',
    backgroundColor: 'transparent',
    ':hover': {
      color: 'var(--color-danger)',
    },
  },
  detailPane: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: 'var(--bg-primary)',
    overflowY: 'auto',
  },
  detailToolbar: {
    display: 'flex',
    alignItems: 'center',
    height: '48px',
    padding: '0 1.5rem',
    borderBottom: '1px solid var(--glass-border)',
    backgroundColor: 'var(--bg-primary)',
    gap: '12px',
  },
  toolbarBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'background-color var(--transition-fast)',
    ':hover': {
      backgroundColor: 'var(--bg-tertiary)',
      color: 'var(--text-primary)',
    },
  },
  toolbarDivider: {
    width: '1px',
    height: '20px',
    backgroundColor: 'var(--glass-border)',
  },
  spamBtn: {
    width: 'auto',
    borderRadius: '16px',
    padding: '0 12px',
    color: '#d93025',
    backgroundColor: 'rgba(217,48,37,0.07)',
    border: '1px solid rgba(217,48,37,0.2)',
  },
  notSpamBtn: {
    width: 'auto',
    borderRadius: '16px',
    padding: '0 12px',
    color: '#1e8e3e',
    backgroundColor: 'rgba(30,142,62,0.07)',
    border: '1px solid rgba(30,142,62,0.2)',
  },
  detailBodyContainer: {
    padding: '1.5rem 2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    overflowY: 'auto',
  },
  detailSubject: {
    fontFamily: 'var(--font-display)',
    fontSize: '1.35rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  senderHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  senderAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#e8f0fe',
    color: 'var(--color-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '1.1rem',
  },
  senderNameRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  senderName: {
    fontWeight: '700',
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
  },
  senderDate: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
  },
  recipientRow: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
  },
  attachmentsContainer: {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius-md)',
    padding: '1rem',
    border: '1px solid var(--glass-border)',
  },
  attachmentsTitle: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.85rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    marginBottom: '0.75rem',
  },
  attachmentsList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
  },
  attachmentItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 12px',
    backgroundColor: '#ffffff',
    borderRadius: '20px',
    fontSize: '0.8rem',
    color: 'var(--color-primary)',
    border: '1px solid var(--glass-border)',
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'all var(--transition-fast)',
    boxShadow: '0 1px 2px rgba(60,64,67,0.08)',
    gap: '4px',
  },
  attachmentName: {
    color: 'var(--text-primary)',
    marginRight: '6px',
    fontWeight: '600',
  },
  attachmentSize: {
    fontSize: '0.75rem',
  },
  messageBody: {
    fontSize: '0.95rem',
    lineHeight: '1.6',
    color: 'var(--text-primary)',
  },
  composeWindow: {
    position: 'fixed',
    bottom: 0,
    right: '80px',
    width: '540px',
    height: '500px',
    backgroundColor: '#ffffff',
    border: '1px solid var(--glass-border)',
    borderRadius: '8px 8px 0 0',
    boxShadow: '0 8px 10px 1px rgba(0,0,0,0.14), 0 3px 14px 2px rgba(0,0,0,0.12), 0 5px 5px -3px rgba(0,0,0,0.2)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 1000,
    overflow: 'hidden',
  },
  composeWindowHeader: {
    padding: '10px 16px',
    backgroundColor: '#f2f6fc',
    color: 'var(--text-primary)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--glass-border)',
  },
  composeTitle: {
    fontWeight: '700',
    fontSize: '0.875rem',
  },
  closeCompose: {
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  composeForm: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '0 16px 16px 16px',
    overflowY: 'auto',
  },
  composeInputRow: {
    display: 'flex',
    alignItems: 'center',
    borderBottom: '1px solid #f1f3f4',
    padding: '8px 0',
    gap: '8px',
  },
  composeInputLabel: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    width: '50px',
  },
  composeInput: {
    flex: 1,
    border: 'none',
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    backgroundColor: 'transparent',
  },
  composeBodyWrapper: {
    flex: 1,
    padding: '12px 0',
    display: 'flex',
  },
  composeTextarea: {
    flex: 1,
    border: 'none',
    resize: 'none',
    fontSize: '0.95rem',
    lineHeight: '1.5',
    color: 'var(--text-primary)',
    backgroundColor: 'transparent',
  },
  composeFileList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    padding: '8px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '4px',
    border: '1px solid var(--glass-border)',
    marginBottom: '8px',
  },
  composeFileItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '4px 8px',
    backgroundColor: '#ffffff',
    borderRadius: '4px',
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    maxWidth: '220px',
  },
  removeFileBtn: {
    marginLeft: '6px',
    color: 'var(--text-muted)',
    cursor: 'pointer',
  },
  composeFooter: {
    borderTop: '1px solid #f1f3f4',
    paddingTop: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attachBtn: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 16px',
    border: '1px solid var(--glass-border)',
    color: 'var(--text-secondary)',
    borderRadius: '16px',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  sendBtn: {
    padding: '8px 24px',
    backgroundColor: 'var(--color-primary)',
    color: '#ffffff',
    borderRadius: '18px',
    fontSize: '0.875rem',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)',
  },
  threadContainer: {
    display: 'flex',
    flexDirection: 'column',
    marginTop: '1rem',
  },
  threadCard: {
    borderBottom: '1px solid var(--glass-border)',
    backgroundColor: '#ffffff',
    padding: '16px 0',
  },
  threadCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    cursor: 'pointer',
    backgroundColor: 'transparent',
    userSelect: 'none',
    transition: 'background-color var(--transition-fast)',
    borderRadius: '4px',
  },
  threadCardBody: {
    padding: '16px 16px 16px 52px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  senderEmail: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    fontWeight: '400',
    marginLeft: '6px',
  },
  threadSnippet: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    marginTop: '4px',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  },
  listActionBar: {
    height: '48px',
    borderBottom: '1px solid var(--glass-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 1rem',
    backgroundColor: '#ffffff',
    flexShrink: 0,
  },
  actionCheckbox: {
    cursor: 'pointer',
    margin: 0,
    width: '14px',
    height: '14px',
  },
  paginationText: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
  },
  rteContainer: {
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid var(--glass-border)',
    borderRadius: '8px',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    width: '100%',
  },
  rteToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    backgroundColor: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--glass-border)',
  },
  rteToolbarBtn: {
    padding: '4px 8px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '24px',
    height: '24px',
    ':hover': {
      backgroundColor: 'var(--bg-tertiary)',
    },
  },
  rteDivider: {
    width: '1px',
    height: '16px',
    backgroundColor: 'var(--glass-border)',
    margin: '0 4px',
  },
  rteEditor: {
    minHeight: '120px',
    padding: '12px',
    outline: 'none',
    fontSize: '0.925rem',
    color: '#000000',
    backgroundColor: '#ffffff',
    textAlign: 'left',
    overflowY: 'auto',
  },
  quickReplyContainer: {
    borderTop: '1px solid var(--glass-border)',
    padding: '1.5rem',
    backgroundColor: 'var(--bg-secondary)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  quickReplyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
  },
  closeReplyBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
  },
  replyToolbarBtn: {
    display: 'flex',
    alignItems: 'center',
    padding: '0.5rem 1rem',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--glass-border)',
    borderRadius: '24px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '0.85rem',
    transition: 'background-color var(--transition-fast)',
  },
};
