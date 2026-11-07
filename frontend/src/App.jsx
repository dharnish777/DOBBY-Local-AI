
import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";

const API = "http://127.0.0.1:8000";

const navItems = [
  { id: "search", label: "Search", icon: "⌕" },
  { id: "projects", label: "Projects", icon: "▣" },
  { id: "artifacts", label: "Artifacts", icon: "▤" },
  { id: "code", label: "Code", icon: "</>" },
  { id: "customize", label: "Customize", icon: "⚙" },
];

function DobbyLogo({ thinking = false, className = "" }) {
  const logoSrc = thinking ? "/DOBBY-thinking-mascot.gif" : "/dobby-logo.svg";

  return (
    <span className={`dobby-logo ${thinking ? "thinking" : ""} ${className}`}>
      <img src={logoSrc} alt="DOBBY mascot" draggable="false" />
    </span>
  );
}

function App() {
  const [chats, setChats] = useState([]);
  const [chatId, setChatId] = useState(
    () => localStorage.getItem("dobby_active_chat")
  );
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("chat");
  const [pinned, setPinned] = useState(
    () => JSON.parse(localStorage.getItem("dobby_pinned_chats") || "[]")
  );
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [lockedChats, setLockedChats] = useState(
    () => JSON.parse(localStorage.getItem("dobby_locked_chats") || "[]")
  );
  const [archivedChats, setArchivedChats] = useState(
    () => JSON.parse(localStorage.getItem("dobby_archived_chats") || "[]")
  );

  const refreshChats = useCallback(async () => {
    const response = await fetch(`${API}/chats`);
    if (!response.ok) throw new Error("Could not load conversations.");
    const data = await response.json();
    setChats(data.chats || []);
    return data.chats || [];
  }, []);

  const loadChat = useCallback(async (id) => {
    const response = await fetch(`${API}/chats/${id}`);
    if (!response.ok) throw new Error("Could not load this conversation.");

    const data = await response.json();
    setChatId(id);
    localStorage.setItem("dobby_active_chat", id);
    setMessages(data.messages || []);
    setError("");
  }, []);

  const createChat = async () => {
    try {
      setError("");
      const response = await fetch(`${API}/chats`, { method: "POST" });
      if (!response.ok) throw new Error("Could not create a new chat.");

      const data = await response.json();
      setChatId(data.id);
      localStorage.setItem("dobby_active_chat", data.id);
      setMessages([]);
      await refreshChats();
      setNotice("");
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    async function initialize() {
      try {
        const chatList = await refreshChats();
        const savedId = localStorage.getItem("dobby_active_chat");
        const savedExists = chatList.some((chat) => chat.id === savedId);

        if (savedExists) {
          await loadChat(savedId);
        } else if (chatList.length) {
          await loadChat(chatList[0].id);
        } else {
          await createChat();
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setInitializing(false);
      }
    }
    initialize();
  }, [refreshChats, loadChat]);

  useEffect(() => {
    localStorage.setItem("dobby_pinned_chats", JSON.stringify(pinned));
  }, [pinned]);

  useEffect(() => {
    localStorage.setItem("dobby_locked_chats", JSON.stringify(lockedChats));
  }, [lockedChats]);

  useEffect(() => {
    localStorage.setItem("dobby_archived_chats", JSON.stringify(archivedChats));
  }, [archivedChats]);

  useEffect(() => {
    if (!openMenuId) return undefined;
    const closeMenu = (event) => {
      if (event.key === "Escape") setOpenMenuId(null);
    };
    const closeOnOutsideClick = () => setOpenMenuId(null);
    window.addEventListener("keydown", closeMenu);
    window.addEventListener("click", closeOnOutsideClick);
    return () => {
      window.removeEventListener("keydown", closeMenu);
      window.removeEventListener("click", closeOnOutsideClick);
    };
  }, [openMenuId]);

  const sendMessage = async (event) => {
    event?.preventDefault();
    const message = input.trim();
    if (!message || loading || initializing) return;

    let activeId = chatId;

    try {
      setError("");

      if (!activeId) {
        const created = await fetch(`${API}/chats`, { method: "POST" });
        if (!created.ok) throw new Error("Could not create a chat.");
        const data = await created.json();
        activeId = data.id;
        setChatId(activeId);
        localStorage.setItem("dobby_active_chat", activeId);
      }

      setInput("");
      setMessages((previous) => [
        ...previous,
        { role: "user", content: message },
      ]);
      setLoading(true);

      const response = await fetch(
        `${API}/chats/${activeId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "DOBBY couldn't send that message.");
      }

      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: data.response },
      ]);
      await refreshChats();
    } catch (err) {
      setError(err.message);
      if (activeId) {
        try {
          await loadChat(activeId);
        } catch {
          // Preserve the original error.
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const selectChat = async (id) => {
    if (loading || id === chatId) return;
    if (lockedChats.includes(id)) {
      setNotice("This chat is locked in this browser. Use its menu to unlock it.");
      return;
    }
    try {
      await loadChat(id);
      setNotice("");
      setSearchOpen(false);
      setSearch("");
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteChat = async (id) => {
    if (!window.confirm("Delete this conversation permanently?")) return;

    try {
      const response = await fetch(`${API}/chats/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Could not delete conversation.");

      const next = await refreshChats();
      setPinned((items) => items.filter((item) => item !== id));
      setLockedChats((items) => items.filter((item) => item !== id));
      setArchivedChats((items) => items.filter((item) => item !== id));

      if (id === chatId) {
        if (next.length) {
          await loadChat(next[0].id);
        } else {
          setChatId(null);
          localStorage.removeItem("dobby_active_chat");
          setMessages([]);
          await createChat();
        }
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const renameChat = async (chat) => {
    const title = window.prompt("Rename conversation:", chat.title);
    if (title === null || !title.trim()) return;

    try {
      const response = await fetch(`${API}/chats/${chat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      if (!response.ok) throw new Error("Could not rename conversation.");
      await refreshChats();
    } catch (err) {
      setError(err.message);
    }
  };

  const togglePin = (id) => {
    setPinned((items) =>
      items.includes(id)
        ? items.filter((item) => item !== id)
        : [...items, id]
    );
  };

  const toggleChatLock = (id) => {
    const willLock = !lockedChats.includes(id);
    setLockedChats((items) =>
      willLock ? [...items, id] : items.filter((item) => item !== id)
    );
    setOpenMenuId(null);
    setNotice(willLock
      ? "Chat locked in this browser (not password-protected)."
      : "Chat unlocked.");
  };

  const toggleArchive = (id) => {
    const willArchive = !archivedChats.includes(id);
    setArchivedChats((items) =>
      willArchive ? [...items, id] : items.filter((item) => item !== id)
    );
    if (willArchive) {
      setPinned((items) => items.filter((item) => item !== id));
      if (id === chatId) {
        const next = chats.find((chat) => chat.id !== id && !archivedChats.includes(chat.id));
        if (next) loadChat(next.id);
        else {
          setChatId(null);
          localStorage.removeItem("dobby_active_chat");
          setMessages([]);
          createChat();
        }
      }
    }
    setOpenMenuId(null);
    setNotice(willArchive ? "Chat archived in this browser." : "Chat restored to your chat list.");
  };

  const shareChat = async (chat) => {
    try {
      const response = await fetch(`${API}/chats/${chat.id}`);
      if (!response.ok) throw new Error("Could not load this conversation.");
      const data = await response.json();
      const transcript = (data.messages || []).map((message) =>
        `${message.role === "user" ? "You" : "DOBBY"}: ${message.content}`
      ).join("\n\n");
      const shareText = `${chat.title || "DOBBY conversation"}\n\n${transcript}`;
      if (navigator.share) {
        await navigator.share({ title: chat.title || "DOBBY conversation", text: shareText });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        setNotice("Conversation copied to clipboard.");
      } else {
        throw new Error("Sharing is not available in this browser.");
      }
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message || "Could not share conversation.");
    } finally {
      setOpenMenuId(null);
    }
  };

  const showChatMenu = (event, id) => {
    event.stopPropagation();
    if (openMenuId === id) {
      setOpenMenuId(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 232;
    const menuHeight = 390;
    const left = Math.max(8, Math.min(rect.left - menuWidth + rect.width, window.innerWidth - menuWidth - 8));
    const top = Math.max(8, Math.min(rect.top - 88, window.innerHeight - menuHeight - 8));
    setMenuPosition({ top, left });
    setOpenMenuId(id);
  };

  const showFeatureNotice = (label) => {
    setNotice(`${label} is planned for a future DOBBY update.`);
    setSearchOpen(false);
  };

  const filteredChats = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return chats;
    return chats.filter((chat) =>
      (chat.title || "").toLowerCase().includes(query)
    );
  }, [chats, search]);

  const visibleChats = filteredChats.filter((chat) => !archivedChats.includes(chat.id));
  const pinnedChats = visibleChats.filter((chat) => pinned.includes(chat.id));
  const regularChats = visibleChats.filter((chat) => !pinned.includes(chat.id));

  const formatGroup = (value) => {
    if (!value) return "Older";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Older";

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);

    if (date >= today) return "Today";
    if (date >= yesterday) return "Yesterday";
    if (date >= lastWeek) return "Previous 7 days";
    return "Older";
  };

  const groupedChats = regularChats.reduce((groups, chat) => {
    const group = formatGroup(chat.updated_at || chat.created_at);
    if (!groups[group]) groups[group] = [];
    groups[group].push(chat);
    return groups;
  }, {});

  const groupOrder = ["Today", "Yesterday", "Previous 7 days", "Older"];

  const renderChatItem = (chat) => (
    <div
      className={`chat-item ${chat.id === chatId ? "active" : ""} ${lockedChats.includes(chat.id) ? "is-locked" : ""}`}
      key={chat.id}
      onClick={() => selectChat(chat.id)}
      title={chat.title}
    >
      <span className="chat-item-title">
        {lockedChats.includes(chat.id) && <span className="chat-lock-indicator">▣ </span>}
        {chat.title || "Untitled"}
      </span>
      <div className="chat-item-actions">
        <button
          className="chat-more-button"
          title="More chat options"
          aria-label={`More options for ${chat.title || "conversation"}`}
          aria-expanded={openMenuId === chat.id}
          onClick={(event) => showChatMenu(event, chat.id)}
        >
          ⋯
        </button>
      </div>
      {openMenuId === chat.id && (
        <div
          className="chat-context-menu"
          style={{ top: menuPosition.top, left: menuPosition.left }}
          onClick={(event) => event.stopPropagation()}
        >
          <button onClick={() => { setOpenMenuId(null); renameChat(chat); }}>
            <span className="menu-icon">✎</span> Rename
          </button>
          <button onClick={() => { togglePin(chat.id); setOpenMenuId(null); }}>
            <span className="menu-icon">⌑</span> {pinned.includes(chat.id) ? "Unpin" : "Pin"}
          </button>
          <button onClick={() => toggleChatLock(chat.id)}>
            <span className="menu-icon">▣</span> {lockedChats.includes(chat.id) ? "Unlock chat" : "Lock chat"}
          </button>
          <div className="context-divider" />
          <button onClick={() => shareChat(chat)}>
            <span className="menu-icon">↥</span> Share
          </button>
          <div className="context-divider" />
          <button onClick={() => toggleArchive(chat.id)}>
            <span className="menu-icon">▱</span> Archive
          </button>
          <button className="danger" onClick={() => { setOpenMenuId(null); deleteChat(chat.id); }}>
            <span className="menu-icon">♧</span> Delete
          </button>
          <div className="context-divider" />
          <button onClick={() => { setOpenMenuId(null); showFeatureNotice("Move to project"); }}>
            <span className="menu-icon">▱</span> Move to project <span className="context-chevron">›</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <DobbyLogo className="brand-mascot" />
          <span>DOBBY</span>
        </div>

        <button className="nav-item primary" onClick={createChat}>
          <span className="nav-icon">＋</span>
          <span>New chat</span>
        </button>

        {navItems.map((item) => (
          <button
            className="nav-item"
            key={item.id}
            onClick={() => {
              if (item.id === "search") {
                setSearchOpen((value) => !value);
                setNotice("");
              } else {
                showFeatureNotice(item.label);
              }
            }}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
            {item.id === "code" && <span className="nav-badge">Soon</span>}
          </button>
        ))}

        {searchOpen && (
          <div className="sidebar-search">
            <input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search conversations..."
            />
          </div>
        )}

        <section className="nav-section">
          <div className="nav-section-title">
            <span>Pinned</span>
            <span>{pinnedChats.length}</span>
          </div>
          <div className="pinned-list">
            {pinnedChats.map(renderChatItem)}
            {pinnedChats.length === 0 && (
              <div className="sidebar-empty">Pin a chat to keep it here.</div>
            )}
          </div>
        </section>

        {archivedChats.length > 0 && (
          <section className="nav-section">
            <div className="nav-section-title">
              <span>Archived</span>
              <span>{chats.filter((chat) => archivedChats.includes(chat.id)).length}</span>
            </div>
            <div className="pinned-list">
              {chats.filter((chat) => archivedChats.includes(chat.id)).map(renderChatItem)}
            </div>
          </section>
        )}

        <section className="nav-section chats-section">
          <div className="nav-section-title">
            <span>Chats and tasks</span>
            <span>{regularChats.length}</span>
          </div>

          <div className="chat-list">
            {groupOrder.map((group) =>
              groupedChats[group]?.length ? (
                <div className="chat-group" key={group}>
                  <div className="chat-group-title">{group}</div>
                  {groupedChats[group].map(renderChatItem)}
                </div>
              ) : null
            )}

            {regularChats.length === 0 && (
              <div className="sidebar-empty">
                {search ? "No matching conversations." : "Your chats will appear here."}
              </div>
            )}
          </div>
        </section>

        <div className="sidebar-bottom">
          <span className="status-dot" />
          <span>DOBBY is running locally</span>
          <span className="sidebar-version">LOCAL</span>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-model">DOBBY <span>· Local AI</span></div>
          <div className="topbar-right">
            <span className="plan-label">Local workspace</span>
            <DobbyLogo className="header-mascot" />
          </div>
        </header>

        <section className={`conversation ${messages.length ? "has-messages" : ""}`}>
          {initializing ? (
            <div className="welcome">
              <div className="greeting"><DobbyLogo className="welcome-mascot" /> Waking up DOBBY</div>
              <p>Preparing your local assistant...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="welcome">
              <div className="greeting">
                <DobbyLogo className="welcome-mascot" />
                Ready when you are.
              </div>
              <p>Your personal AI workspace, running locally.</p>
            </div>
          ) : (
            <div className="messages">
              {messages.map((message, index) => (
                <div
                  className={`message ${
                    message.role === "user" ? "user-message" : "assistant-message"
                  }`}
                  key={message.id || `${index}-${message.role}`}
                >
                  {message.role === "assistant" && (
                    <DobbyLogo className="message-mascot" />
                  )}
                  <div className="message-content">{message.content}</div>
                </div>
              ))}

              {loading && (
                <div className="message assistant-message">
                  <DobbyLogo thinking className="message-mascot" />
                  <span className="thinking-label">DOBBY is thinking...</span>
                </div>
              )}
            </div>
          )}
        </section>

        {(error || notice) && (
          <div className={error ? "app-notice error" : "app-notice"}>
            {error || notice}
            <button onClick={() => { setError(""); setNotice(""); }}>×</button>
          </div>
        )}

        <footer className="composer-area">
          <form className="input-card" onSubmit={sendMessage}>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage(event);
                }
              }}
              placeholder="How can I help you today?"
              rows={1}
              disabled={loading || initializing}
            />

            <div className="input-toolbar">
              <div className="toolbar-left">
                <button
                  type="button"
                  className="icon-btn"
                  title="Attachments are coming soon"
                  onClick={() => showFeatureNotice("Attachments")}
                >
                  ＋
                </button>
                <button
                  type="button"
                  className={`mode-pill ${mode === "chat" ? "active" : ""}`}
                  onClick={() => setMode("chat")}
                >
                  Chat
                </button>
                <button
                  type="button"
                  className="mode-pill disabled-mode"
                  title="Cowork is not connected yet"
                  onClick={() => showFeatureNotice("Cowork")}
                >
                  Cowork
                </button>
              </div>

              <div className="toolbar-right">
                <div className="model-select">
                  <span>Qwen 1.5B</span>
                  <span className="model-tier">Local</span>
                </div>
                <button
                  className="send-btn"
                  type="submit"
                  disabled={!input.trim() || loading || initializing}
                  aria-label="Send message"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </form>

          <div className="composer-hint">
            DOBBY runs locally on your computer · Enter to send, Shift + Enter for a new line
          </div>
        </footer>
      </main>
    </div>
  );
}

export default App;
