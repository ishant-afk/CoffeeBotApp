import { useState, useRef, useEffect } from 'react'
import { Coffee, Send, Sparkles, Smile, MessageSquare, Star, Search, XCircle, Plus, Utensils, Droplets, Snowflake, Menu as MenuIcon, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './App.css'

export default function App() {
  const [menuItems, setMenuItems] = useState([])
  const [messages, setMessages] = useState([
    { id: '1', role: 'bot', text: "Welcome to Merry's Way! ☕ How can I brew some magic for you today?" }
  ])

  const [inputVal, setInputVal] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMenuLoading, setIsMenuLoading] = useState(true)
  const bottomRef = useRef(null)

  useEffect(() => {
    // Dynamic Menu Loading
    setIsMenuLoading(true);
    fetch('/products.jsonl')
      .then(res => res.text())
      .then(text => {
        const items = text.split('\n')
          .filter(line => line.trim())
          .map((line, index) => {
            try {
              const data = JSON.parse(line);
              let type = 'hot';
              if (data.category === 'Bakery') type = 'food';
              else if (data.name.toLowerCase().includes('iced')) type = 'iced';
              else if (data.category === 'Flavours') type = 'addon';

              return {
                id: index,
                name: data.name,
                category: data.category,
                price: `$${parseFloat(data.price).toFixed(2)}`,
                desc: data.description,
                type: type,
                rating: data.rating
              };
            } catch (e) {
              return null;
            }
          })
          .filter(item => item !== null);

        setMenuItems(items);
        setIsMenuLoading(false);
      })
      .catch(err => {
        console.error("Menu fetch error:", err);
        setIsMenuLoading(false);
      });
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const handleSend = async (text = inputVal) => {
    if (!text.trim()) return
    const userMsg = { id: Date.now().toString(), role: 'user', text: text.trim(), content: text.trim() }

    // Add user message to UI immediately
    setMessages(prev => [...prev, userMsg])
    setInputVal('')
    setIsTyping(true)

    try {
      // Assemble history context in standardized JSON format to preserve 'memory'
      const historyList = [...messages, userMsg].map(m => ({
        role: m.role === 'bot' ? 'Assistant' : 'User',
        content: m.text || m.content,
        memory: m.memory || {} // CRITICAL: This allows the model to remember the cart/state
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: historyList })
      });

      const data = await response.json();

      let botResponseText = '';
      let botMemory = {};

      if (data.statusCode === 200) {
        let body = data.body;
        if (typeof body === 'string') {
          body = JSON.parse(body);
        }
        botResponseText = body.content || "Hmm, I didn't get that quite right.";
        botMemory = body.memory || {};
      } else {
        botResponseText = `Error from Lambda: ${data.error || JSON.stringify(data)}`;
      }

      let botResponse = {
        id: Date.now().toString(),
        role: 'bot',
        text: botResponseText,
        content: botResponseText,
        memory: botMemory
      }

      // Keep interactive UI widgets based on NLP intent or memory tags
      const lowerArg = text.toLowerCase()
      const agentUsed = botMemory.agent || ''

      if (lowerArg.includes('feedback') || lowerArg.includes('review')) {
        botResponse.component = 'feedback'
      } else if (lowerArg.includes('mood') || lowerArg.includes('feel') || lowerArg.includes('tired')) {
        botResponse.component = 'moodmatch'
      }

      // Priority 3: Trigger Order Review card if finalizing an order
      if (agentUsed === 'order_taking_agent' && botMemory.order?.length > 0) {
        const botText = botResponseText.toLowerCase();
        if (botText.includes('total') || botText.includes('thank you for the order')) {
          botResponse.component = 'order_review';
        }
      }

      setMessages(prev => [...prev, botResponse])
    } catch (err) {
      console.error(err)
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'bot', text: `Connection error: ${err.message}` }])
    } finally {
      setIsTyping(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const filteredMenu = menuItems.filter(item => {
    const matchesCategory = categoryFilter === 'all' || item.type === categoryFilter;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const availableTypes = ['all', ...new Set(menuItems.map(i => i.type))];
  const lastBotWithOrder = messages.filter(m => m.role === 'bot' && m.memory?.order).slice(-1)[0];
  const currentOrderItems = Array.isArray(lastBotWithOrder?.memory?.order) ? lastBotWithOrder.memory.order : [];

  return (
    <div className={`app-container ${isMobileMenuOpen ? 'menu-open' : ''}`}>
      <header className="glass-panel main-header">
        <div className="logo-section">
          <div className="logo-icon">
            <Coffee size={24} />
          </div>
          <div className="logo-text">
            <h1>Merry's Way</h1>
            <span className="desktop-only text-muted">Greenwich Village, NYC</span>
          </div>
        </div>
        <button className="mobile-only menu-toggle" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X size={24} /> : <MenuIcon size={24} />}
        </button>
      </header>

      <div className="main-content">
        <main className="chat-section">
          <div className="chat-messages">
            {messages.length === 1 && (
              <div className="quick-start-container animate-fade-in">
                <div className="quick-start-grid">
                  <div className="quick-card" onClick={() => handleSend("What are your best sellers?")}>
                    <Sparkles size={20} className="icon" />
                    <h4>Best Sellers</h4>
                    <p>Try our fan favorites</p>
                  </div>
                  <div className="quick-card" onClick={() => setCategoryFilter('food')}>
                    <Utensils size={20} className="icon" />
                    <h4>Fresh Bakery</h4>
                    <p>Scones & Croissants</p>
                  </div>
                </div>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`message ${msg.role}`}>
                {msg.role === 'bot' && (
                  <div className="message-icon">
                    <Coffee size={18} color="var(--coffee-accent)" />
                  </div>
                )}
                <div className="message-content">
                  {msg.text && (
                    <div className="markdown-body">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ node, ...props }) => <p style={{ margin: '0 0 0.5rem 0' }} {...props} />,
                          ul: ({ node, ...props }) => <ul className="markdown-list" {...props} />,
                          ol: ({ node, ...props }) => <ol className="markdown-list" {...props} />,
                          li: ({ node, ...props }) => <li className="markdown-li" {...props} />,
                          strong: ({ node, ...props }) => <strong className="markdown-strong" {...props} />,
                          h1: ({ node, ...props }) => <h1 className="markdown-h1" {...props} />,
                          h2: ({ node, ...props }) => <h2 className="markdown-h2" {...props} />,
                          h3: ({ node, ...props }) => <h3 className="markdown-h3" {...props} />
                        }}
                      >
                        {msg.text
                          // 1. Ensure *Item: becomes **Item:** for bolding
                          .replace(/(?:\n|^)\*\s*([A-Za-z\s]+):/g, '\n**$1:**')
                          // 2. Ensure bullets have spaces
                          .replace(/(?:\n|^)\*(?!\*)\s*([^\n]+)/g, '\n* $1')
                          // 3. Prevent double newlines from breaking list groups
                          .trim()}
                      </ReactMarkdown>
                    </div>
                  )}

                  {/* Dynamic Components embedded in chat */}
                  {msg.component === 'builder' && <OrderBuilder handleSend={handleSend} />}
                  {msg.component === 'moodmatch' && <MoodMatchWidget handleSend={handleSend} />}
                  {msg.component === 'feedback' && <FeedbackWidget />}
                  {msg.component === 'order_review' && <OrderReviewWidget order={msg.memory?.order} handleSend={handleSend} />}
                  {msg.component === 'nutrition' && (
                    <div className="rich-content" style={{ fontSize: '0.85rem' }}>
                      <strong>Allergen Warning:</strong> Please note that our kitchen handles dairy, wheat, and nuts.
                      Let your barista know of any severe allergies!
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="message bot">
                <div className="message-icon">
                  <Coffee size={18} color="var(--coffee-accent)" />
                </div>
                <div className="message-content" style={{ flexDirection: 'row', gap: '4px', alignItems: 'center', height: '24px' }}>
                  <span className="dot" style={{ animation: 'bounce 1s infinite' }}>•</span>
                  <span className="dot" style={{ animation: 'bounce 1s infinite 0.2s' }}>•</span>
                  <span className="dot" style={{ animation: 'bounce 1s infinite 0.4s' }}>•</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="suggestion-chips">
            <button className="chip" onClick={() => handleSend("Surprise me with a drink!")}>
              <Sparkles size={14} style={{ display: 'inline', marginRight: '4px' }} /> Surprise Me
            </button>
            <button className="chip" onClick={() => {
              setMessages(prev => [
                ...prev,
                { id: Date.now().toString(), role: 'user', text: "I'd like a drink based on my mood." },
                { id: (Date.now() + 1).toString(), role: 'bot', text: '', component: 'moodmatch' }
              ])
            }}>
              <Smile size={14} style={{ display: 'inline', marginRight: '4px' }} /> Mood Match
            </button>
            <button className="chip" onClick={() => setMessages([{ id: '1', role: 'bot', text: "Welcome to Merry's Way! ☕ How can I brew some magic for you today?" }])}>
              <XCircle size={14} style={{ display: 'inline', marginRight: '4px' }} /> Stop Conversation
            </button>
          </div>

          <div className="chat-input-area">
            <input
              type="text"
              className="chat-input"
              placeholder="Ask about our coffee, menu, or place an order..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              className="send-button"
              onClick={() => handleSend()}
              disabled={!inputVal.trim() || isTyping}
            >
              <Send size={18} />
            </button>
          </div>
        </main>

        <aside className="sidebar">
          {/* Collapsible Order Section */}
          {currentOrderItems.length > 0 && (
            <div className="sidebar-panel glass-panel order-summary animate-slide-in" style={{ flex: 'none', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}><Coffee size={20} /> Your Order</h3>
                <span className="badge">{currentOrderItems.length} items</span>
              </div>
              <div className="order-items-list" style={{ maxHeight: '180px', overflowY: 'auto', marginBottom: '12px' }}>
                {currentOrderItems.map((item, idx) => (
                  <div key={idx} className="order-row animate-fade-in" style={{ animationDelay: `${idx * 0.05}s` }}>
                    <span className="order-item-name">{item.item}</span>
                    <div className="order-row-divider"></div>
                    <span className="order-item-price">${parseFloat(item.price).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="order-row total-row">
                <span>Total</span>
                <div className="order-row-divider"></div>
                <span className="order-item-price">
                  ${currentOrderItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0).toFixed(2)}
                </span>
              </div>
              <button
                className="place-order-btn animate-fade-in"
                style={{ marginTop: '1rem', width: '100%' }}
                onClick={() => {
                  handleSend("I'd like to place my order now.");
                  if (window.innerWidth < 768) setIsMobileMenuOpen(false);
                }}
              >
                Place Order
              </button>
            </div>
          )}

          <div className="sidebar-panel glass-panel" style={{ flex: 1 }}>
            <h3><Search size={20} /> Menu Browser</h3>

            <div className="suggestion-chips" style={{ padding: '0 0 1rem 0', background: 'transparent' }}>
              {['all', 'hot', 'iced', 'food', 'addon'].map(type => (
                availableTypes.includes(type) && (
                  <button
                    key={type}
                    className={`chip ${categoryFilter === type ? 'active' : ''}`}
                    style={categoryFilter === type ? { background: 'var(--coffee-accent)', color: 'var(--coffee-bg)' } : {}}
                    onClick={() => setCategoryFilter(type)}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                )
              ))}
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <input
                type="text"
                className="chat-input"
                style={{ width: '100%', padding: '0.6rem 1rem', fontSize: '0.9rem' }}
                placeholder="Search menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="menu-list">
              {isMenuLoading ? (
                /* Skeleton Loader */
                [1, 2, 3, 4].map(i => (
                  <div key={i} className="menu-item skeleton-item">
                    <div className="menu-img skeleton"></div>
                    <div className="menu-details">
                      <div className="skeleton title"></div>
                      <div className="skeleton desc"></div>
                    </div>
                  </div>
                ))
              ) : (
                filteredMenu.map(item => (
                  <div key={item.id} className="menu-item group" onClick={() => handleSend(`Tell me more about ${item.name}`)}>
                    <div className="menu-img">
                      {item.type === 'food' ? <Utensils size={24} /> :
                        item.type === 'iced' ? <Snowflake size={24} /> :
                          item.type === 'addon' ? <Droplets size={24} /> :
                            <Coffee size={24} />}
                    </div>
                    <div className="menu-details">
                      <div className="menu-name">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {item.name}
                          {item.rating && <span className="rating-tag"><Star size={10} fill="currentColor" /> {item.rating}</span>}
                        </div>
                        <span className="menu-price">{item.price}</span>
                      </div>
                      <div className="menu-desc line-clamp-2">{item.desc}</div>
                      <div className="menu-footer">
                        <button className="add-btn" onClick={(e) => {
                          e.stopPropagation();
                          handleSend(`I'd like to order a ${item.name}`);
                          if (window.innerWidth < 768) setIsMobileMenuOpen(false);
                        }}>
                          <Plus size={14} /> Add to Order
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}


function FeedbackWidget() {
  const [rating, setRating] = useState(0)
  const [submitted, setSubmitted] = useState(false)

  if (submitted) {
    return (
      <div className="rich-content" style={{ color: 'var(--coffee-accent)', textAlign: 'center' }}>
        Thank you! Your feedback helps us brew better experiences. ❤️
      </div>
    )
  }

  return (
    <div className="rich-content">
      <div style={{ marginBottom: '0.5rem' }}>Rate your latest order:</div>
      <div className="star-rating">
        {[1, 2, 3, 4, 5].map(star => (
          <Star
            key={star}
            size={24}
            fill={star <= rating ? 'var(--coffee-accent)' : 'none'}
            className={`star ${star <= rating ? 'active' : ''}`}
            onClick={() => {
              setRating(star)
              setTimeout(() => setSubmitted(true), 800)
            }}
          />
        ))}
      </div>
    </div>
  )
}

function MoodMatchWidget({ handleSend }) {
  const moods = [
    { label: 'Tired 🥱', prompt: 'I am feeling very tired and need a pick-me-up.' },
    { label: 'Stressed 😫', prompt: 'I am feeling stressed. Suggest something comforting.' },
    { label: 'Happy 😊', prompt: 'I am feeling happy and want something sweet and fun!' },
    { label: 'Cold 🥶', prompt: 'I am feeling cold. What warm drink would you recommend?' },
    { label: 'Adventurous 🤠', prompt: 'I am feeling adventurous! Surprise me with a unique recommendation!' }
  ];

  return (
    <div className="rich-content" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <strong style={{ color: 'var(--coffee-accent)' }}>How are you feeling right now?</strong>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
        {moods.map((mood, idx) => (
          <button
            key={idx}
            className="chip"
            style={{ margin: 0 }}
            onClick={() => handleSend(mood.prompt)}
          >
            {mood.label}
          </button>
        ))}
      </div>
    </div>
  )
}
function OrderReviewWidget({ order, handleSend }) {
  if (!order || order.length === 0) return null;
  const total = order.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0).toFixed(2);

  return (
    <div className="rich-content order-review-card animate-slide-in">
      <div className="review-header">
        <Sparkles size={18} style={{ color: 'var(--coffee-accent)' }} />
        <strong style={{ color: 'var(--coffee-accent)', marginLeft: '8px' }}>Review Your Order</strong>
      </div>
      <div className="review-body" style={{ margin: '1rem 0' }}>
        <p style={{ fontSize: '0.85rem', marginBottom: '1rem', color: 'var(--coffee-muted)' }}>
          Please check your selection before we finalize the brew:
        </p>
        <div className="order-items-list">
          {order.map((item, idx) => (
            <div key={idx} className="order-row">
              <span className="order-item-name">{item.item}</span>
              <div className="order-row-divider"></div>
              <span className="order-item-price">${parseFloat(item.price).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="order-row total-row" style={{ borderTop: '1px solid rgba(212, 163, 115, 0.3)', marginTop: '8px', paddingTop: '8px' }}>
          <strong>Total Amount</strong>
          <div className="order-row-divider"></div>
          <span className="order-item-price">${total}</span>
        </div>
      </div>
      <div className="review-actions" style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
        <button className="confirm-btn" onClick={() => handleSend("Yes, please proceed with this order!")}>
          Confirm & Pay
        </button>
        <button className="edit-btn" onClick={() => handleSend("I want to change my order")}>
          Edit
        </button>
      </div>
    </div>
  )
}
