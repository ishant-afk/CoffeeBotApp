import { useState, useRef, useEffect } from 'react'
import { Coffee, Send, Sparkles, Smile, MessageSquare, Star, Search, XCircle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './App.css'

export default function App() {
  const [menuItems, setMenuItems] = useState([])
  const [messages, setMessages] = useState([
    { id: '1', role: 'bot', text: "Welcome to Merry's Way! ☕ How can I brew some magic for you today?" }
  ])

  useEffect(() => {
    // Dynamic Menu Loading: Fetch from public/product.csv and parse
    fetch('/product.csv')
      .then(res => res.text())
      .then(csv => {
        const lines = csv.split('\n');
        const headers = lines[0].split(',');
        const parsed = lines.slice(1).filter(l => l.trim()).map(line => {
          // Basic CSV split (caution: doesn't handle commas inside quotes perfectly but works for this data)
          const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
          return {
            id: cols[0],
            group: cols[1]?.trim(),
            category: cols[2]?.trim(),
            type: cols[3]?.trim(),
            name: cols[4]?.trim(),
            desc: cols[5]?.replace(/"/g, '').trim(),
            price: cols[8]?.trim()
          };
        }).filter(item => ['Beverages', 'Food'].includes(item.group));

        // Map to UI format
        const items = parsed.map(item => ({
          id: item.id,
          name: item.name,
          type: item.group === 'Food' ? 'food' : (item.name.toLowerCase().includes('iced') ? 'iced' : 'hot'),
          price: item.price,
          desc: item.desc
        }));
        setMenuItems(items);
      })
      .catch(err => console.error("Menu fetch error:", err));
  }, [])
  const [inputVal, setInputVal] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const bottomRef = useRef(null)

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

      if (lowerArg.includes('order') || lowerArg.includes('build')) {
        botResponse.component = 'builder'
      } else if (lowerArg.includes('feedback') || lowerArg.includes('review')) {
        botResponse.component = 'feedback'
      } else if (lowerArg.includes('mood') || lowerArg.includes('feel') || lowerArg.includes('tired')) {
        botResponse.component = 'moodmatch'
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

  return (
    <div className="app-container">
      <header className="glass-panel">
        <div className="logo-section">
          <div className="logo-icon">
            <Coffee size={24} />
          </div>
          <div className="logo-text">
            <h1>Merry's Way Coffee</h1>
            <span>Neighborhood coffee shop in Greenwich Village, NYC</span>
          </div>
        </div>
      </header>

      <div className="main-content">
        <main className="chat-section">
          <div className="chat-messages">
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
          {/* New Live Order Section */}
          <div className="sidebar-panel glass-panel order-summary" style={{ flex: 'none', marginBottom: '1rem' }}>
            <h3><Coffee size={20} /> Your Order</h3>
            {messages.filter(m => m.role === 'bot' && m.memory?.order).slice(-1).map(msg => {
              const order = msg.memory.order;
              const items = Array.isArray(order) ? order : [];
              const total = items.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);

              if (items.length === 0) return <div key="empty" className="menu-desc">No items yet. Start ordering!</div>;

              return (
                <div key="order-list">
                  <div className="order-items-list" style={{ maxHeight: '150px', overflowY: 'auto', marginBottom: '10px' }}>
                    {items.map((item, idx) => (
                      <div key={idx} className="menu-name" style={{ fontSize: '0.85rem', marginBottom: '4px' }}>
                        <span>{item.item}</span>
                        <span className="menu-price">${parseFloat(item.price).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="menu-name" style={{ borderTop: '1px solid var(--coffee-border)', paddingTop: '8px', fontWeight: 'bold' }}>
                    <span>Total</span>
                    <span className="menu-price">${total.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
            {messages.filter(m => m.role === 'bot' && m.memory?.order).length === 0 && (
              <div className="menu-desc">No items yet. Start ordering!</div>
            )}
          </div>

          <div className="sidebar-panel glass-panel">
            <h3><Search size={20} /> Menu Browser</h3>

            <div className="suggestion-chips" style={{ padding: '0 0 1rem 0', background: 'transparent' }}>
              <button
                className={`chip ${categoryFilter === 'all' ? 'active' : ''}`}
                style={categoryFilter === 'all' ? { background: 'var(--coffee-accent)', color: 'var(--coffee-bg)' } : {}}
                onClick={() => setCategoryFilter('all')}
              >All</button>
              <button
                className="chip"
                style={categoryFilter === 'hot' ? { background: 'var(--coffee-accent)', color: 'var(--coffee-bg)' } : {}}
                onClick={() => setCategoryFilter('hot')}
              >Hot</button>
              <button
                className="chip"
                style={categoryFilter === 'iced' ? { background: 'var(--coffee-accent)', color: 'var(--coffee-bg)' } : {}}
                onClick={() => setCategoryFilter('iced')}
              >Iced</button>
              <button
                className="chip"
                style={categoryFilter === 'food' ? { background: 'var(--coffee-accent)', color: 'var(--coffee-bg)' } : {}}
                onClick={() => setCategoryFilter('food')}
              >Food</button>
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
              {filteredMenu.map(item => (
                <div key={item.id} className="menu-item" onClick={() => handleSend(`Tell me more about ${item.name}`)}>
                  <div className="menu-img" style={{
                    backgroundImage: `linear-gradient(45deg, var(--coffee-muted), var(--coffee-bg))`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--coffee-accent)'
                  }}>
                    <Coffee size={24} />
                  </div>
                  <div className="menu-details">
                    <div className="menu-name">
                      {item.name}
                      <span className="menu-price">{item.price}</span>
                    </div>
                    <div className="menu-desc">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function OrderBuilder({ handleSend }) {
  const [step, setStep] = useState(1)
  const [size, setSize] = useState('')
  const [milk, setMilk] = useState('')

  if (step === 1) {
    return (
      <div className="rich-content order-builder">
        <strong>1. Choose your size:</strong>
        <div className="options-grid">
          {['Small (8oz)', 'Regular (12oz)', 'Large (16oz)'].map(s => (
            <button
              key={s}
              className={`option-btn ${size === s ? 'selected' : ''}`}
              onClick={() => { setSize(s); setTimeout(() => setStep(2), 300) }}
            >{s}</button>
          ))}
        </div>
      </div>
    )
  }

  if (step === 2) {
    return (
      <div className="rich-content order-builder">
        <strong>Selected Size:</strong> {size} <br /><br />
        <strong>2. Choose your milk:</strong>
        <div className="options-grid">
          {['Whole Milk', 'Oat Milk', 'Almond Milk'].map(m => (
            <button
              key={m}
              className={`option-btn ${milk === m ? 'selected' : ''}`}
              onClick={() => { setMilk(m); setTimeout(() => setStep(3), 300) }}
            >{m}</button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="rich-content order-builder" style={{ textAlign: 'center', color: 'var(--coffee-accent)' }}>
      <strong>✨ Perfect! You chose a {size} drink with {milk}.</strong><br />
      <button className="chip" style={{ marginTop: '0.5rem' }} onClick={() => handleSend(`what would you suggest for: ${size} and ${milk}`)}>
        Confirm & Send Order
      </button>
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
