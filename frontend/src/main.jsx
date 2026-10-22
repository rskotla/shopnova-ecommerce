import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Search, ShoppingBag, UserRound, Heart, Star, ArrowRight, Truck,
  ShieldCheck, RotateCcw, Plus, Minus, X, Menu, Check, Sparkles,
  ChevronRight, PackageCheck, LogOut
} from 'lucide-react'
import './style.css'

const API = import.meta.env.VITE_API_BASE_URL || '/api'
const money = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0)
const fallbackProducts = [
  { id: 1, name: 'Studio Wireless Headphones', category: 'Electronics', description: 'Immersive sound, soft-touch comfort and 40-hour battery life.', price: 6999, original_price: 8999, rating: 4.8, image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85' },
  { id: 2, name: 'Everyday Minimal Sneakers', category: 'Fashion', description: 'A versatile low-profile silhouette made for everyday movement.', price: 3499, original_price: 4999, rating: 4.6, image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85' },
  { id: 3, name: 'Aura Smart Watch', category: 'Electronics', description: 'Health insights, bright AMOLED display and all-day battery.', price: 8999, original_price: 11999, rating: 4.7, image_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=85' },
  { id: 4, name: 'Carryall Weekend Bag', category: 'Lifestyle', description: 'A durable, thoughtfully organized companion for short trips.', price: 4299, original_price: 5499, rating: 4.5, image_url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=85' },
  { id: 5, name: 'Modern Ceramic Table Lamp', category: 'Home', description: 'Warm ambient lighting with a sculptural, understated finish.', price: 2799, original_price: 3599, rating: 4.4, image_url: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=85' },
  { id: 6, name: 'Performance Running Shoes', category: 'Fashion', description: 'Responsive cushioning and a breathable engineered upper.', price: 5299, original_price: 6999, rating: 4.7, image_url: 'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=900&q=85' },
  { id: 7, name: 'Essential Skincare Set', category: 'Lifestyle', description: 'A simple daily routine with clean, lightweight essentials.', price: 1899, original_price: 2499, rating: 4.3, image_url: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=900&q=85' },
  { id: 8, name: 'Compact Bluetooth Speaker', category: 'Electronics', description: 'Room-filling audio in a portable, minimal design.', price: 2999, original_price: 3999, rating: 4.6, image_url: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=85' },
]
const categories = ['All', 'Electronics', 'Fashion', 'Home', 'Lifestyle']

function App() {
  const [products, setProducts] = useState(fallbackProducts)
  const [category, setCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [ordersOpen, setOrdersOpen] = useState(false)
  const [orders, setOrders] = useState([])
  const [token, setToken] = useState(() => localStorage.getItem('shopnova_token') || '')
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('shopnova_user') || 'null') } catch { return null }
  })
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)

  useEffect(() => {
    fetch(`${API}/products`).then(r => r.ok ? r.json() : Promise.reject()).then(setProducts).catch(() => {})
  }, [])
  useEffect(() => {
    if (token) loadCart()
    else setCart([])
  }, [token])
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(''), 3200)
    return () => clearTimeout(t)
  }, [notice])

  const filtered = useMemo(() => products.filter(p =>
    (category === 'All' || p.category === category) &&
    `${p.name} ${p.description} ${p.category}`.toLowerCase().includes(search.toLowerCase())
  ), [products, category, search])
  const cartCount = cart.reduce((n, i) => n + i.quantity, 0)
  const subtotal = cart.reduce((n, i) => n + (i.product?.price || 0) * i.quantity, 0)

  async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
    if (token) headers.Authorization = `Bearer ${token}`
    const response = await fetch(`${API}${path}`, { ...options, headers })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.')
    return data
  }
  async function loadCart() {
    try { const data = await api('/cart'); setCart(data.items || []) } catch (e) {
      if (e.message.toLowerCase().includes('token')) logout()
    }
  }
  function logout() {
    setToken(''); setUser(null); setCart([])
    localStorage.removeItem('shopnova_token'); localStorage.removeItem('shopnova_user')
    setNotice('You have been signed out.')
  }
  async function addToCart(product) {
    if (!token) { setAuthMode('login'); setAuthOpen(true); setNotice('Sign in to add items to your bag.'); return }
    try { await api('/cart', { method: 'POST', body: JSON.stringify({ product_id: product.id, quantity: 1 }) }); await loadCart(); setNotice(`${product.name} added to your bag.`) }
    catch (e) { setNotice(e.message) }
  }
  async function changeQuantity(item, quantity) {
    try {
      if (quantity <= 0) await api(`/cart/${item.id}`, { method: 'DELETE' })
      else await api(`/cart/${item.id}`, { method: 'PATCH', body: JSON.stringify({ quantity }) })
      await loadCart()
    } catch (e) { setNotice(e.message) }
  }
  async function submitAuth(e) {
    e.preventDefault(); setBusy(true)
    const fd = new FormData(e.currentTarget)
    const body = Object.fromEntries(fd.entries())
    try {
      const data = await api(`/auth/${authMode === 'login' ? 'login' : 'register'}`, { method: 'POST', body: JSON.stringify(body) })
      setToken(data.access_token); setUser(data.user)
      localStorage.setItem('shopnova_token', data.access_token); localStorage.setItem('shopnova_user', JSON.stringify(data.user))
      setAuthOpen(false); setNotice(`Welcome${data.user.name ? `, ${data.user.name.split(' ')[0]}` : ' back'}!`)
    } catch (e) { setNotice(e.message) } finally { setBusy(false) }
  }
  async function checkout() {
    try {
      const order = await api('/orders', { method: 'POST', body: JSON.stringify({}) })
      await loadCart()
      setCartOpen(false); setNotice(`Order #${order.id} confirmed. Payment is not collected in this demo.`)
      await loadOrders()
    } catch (e) { setNotice(e.message) }
  }
  async function loadOrders() {
    try { setOrders(await api('/orders')); setOrdersOpen(true) } catch (e) { setNotice(e.message) }
  }

  return <div className="min-h-screen bg-[#f8f8f6] text-[#20231f]">
    <div className="announcement"><Sparkles size={13}/> The little things, exceptionally well. <span className="announcement-sep">·</span> CI/CD Release Test (Rohit Sharma) — Build Verification.</div>
    <header className="site-header">
      <div className="header-inner">
        <button className="icon-button mobile-only" aria-label="Open menu" onClick={() => setMobileMenu(!mobileMenu)}><Menu size={21}/></button>
        <a href="#" className="brand" onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
          <span className="brand-mark">s<span>.</span></span><span>shopnova</span>
        </a>
        <nav className={`main-nav ${mobileMenu ? 'nav-open' : ''}`}>
          <a href="#shop" onClick={() => setMobileMenu(false)}>Shop all</a>
          <a href="#shop" onClick={() => { setCategory('Fashion'); setMobileMenu(false) }}>Fashion</a>
          <a href="#shop" onClick={() => { setCategory('Electronics'); setMobileMenu(false) }}>Tech & audio</a>
          <a href="#values" onClick={() => setMobileMenu(false)}>Our story</a>
        </nav>
        <div className="header-actions">
          <label className="search-box"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search good things..." aria-label="Search products"/><kbd>⌘ K</kbd></label>
          <button className="icon-button account-button" aria-label="Account" onClick={() => user ? loadOrders() : setAuthOpen(true)}>{user ? <span className="avatar">{user.name?.[0]?.toUpperCase() || 'U'}</span> : <UserRound size={20}/>}</button>
          {user && <button className="icon-button logout-button" title="Sign out" onClick={logout}><LogOut size={18}/></button>}
          <button className="bag-button" onClick={() => setCartOpen(true)} aria-label={`Shopping bag, ${cartCount} items`}><ShoppingBag size={19}/><span>Bag</span><b>{cartCount}</b></button>
        </div>
      </div>
    </header>

    <main>
      <section className="hero-wrap">
        <div className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-line"/> THE EVERYDAY EDIT · VOL. 04</div>
            <h1>Good things.<br/><em>Better living.</em></h1>
            <p>Considered essentials for the way you live, work, move and unwind. Find something you’ll love keeping around.</p>
            <a className="primary-button" href="#shop">Explore the collection <ArrowRight size={17}/></a>
            <div className="hero-note"><span className="tiny-stars">★★★★★</span><span>Loved by 12,000+ happy customers</span></div>
          </div>
          <div className="hero-visual">
            <img src="https://images.unsplash.com/photo-1490312278390-ab64016e0aa9?auto=format&fit=crop&w=1400&q=90" alt="Thoughtfully curated everyday objects on a warm neutral background"/>
            <div className="hero-float"><span className="float-dot"/><div><strong>Made for your everyday</strong><small>Small upgrades. Big feeling.</small></div><ArrowRight size={16}/></div>
            <div className="hero-index">01 <span/> 04</div>
          </div>
        </div>
      </section>

      <section className="trust-strip" id="values">
        <div><Truck size={20}/><span><strong>Free delivery</strong><small>On orders over ₹1,499</small></span></div>
        <div><ShieldCheck size={20}/><span><strong>Secure by design</strong><small>Your details stay yours</small></span></div>
        <div><RotateCcw size={20}/><span><strong>Easy returns</strong><small>30-day return window*</small></span></div>
        <div><PackageCheck size={20}/><span><strong>Picked with care</strong><small>Quality over quantity</small></span></div>
      </section>

      <section className="category-section">
        <div className="section-heading"><div><span className="eyebrow">A LITTLE OF EVERYTHING</span><h2>What are you in the mood for?</h2></div><span className="heading-aside">Good taste, no guesswork.</span></div>
        <div className="category-grid">
          {[
            { name: 'Electronics', label: 'Tech that just clicks', img: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=700&q=85', num: '01' },
            { name: 'Fashion', label: 'Wear it your way', img: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=700&q=85', num: '02' },
            { name: 'Home', label: 'Make room for calm', img: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=700&q=85', num: '03' },
            { name: 'Lifestyle', label: 'Everyday, elevated', img: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=700&q=85', num: '04' },
          ].map(c => <button className="category-card" key={c.name} onClick={() => { setCategory(c.name); document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' }) }}>
            <img src={c.img} alt=""/><span className="category-number">{c.num}</span><span className="category-caption"><strong>{c.name}</strong><small>{c.label}</small></span><span className="category-arrow"><ArrowRight size={17}/></span>
          </button>)}
        </div>
      </section>

      <section className="products-section" id="shop">
        <div className="section-heading product-heading"><div><span className="eyebrow">THE GOOD STUFF</span><h2>Current favourites<span className="period">.</span></h2><p>Well-made things you’ll reach for, again and again.</p></div><a className="text-link" href="#shop" onClick={e => { e.preventDefault(); setCategory('All'); setSearch('') }}>View everything <ArrowRight size={16}/></a></div>
        <div className="filter-row">
          <div className="filter-tabs">{categories.map(c => <button key={c} className={category === c ? 'filter-tab active' : 'filter-tab'} onClick={() => setCategory(c)}>{c}</button>)}</div>
          <span className="results-count">{filtered.length} thoughtfully picked items</span>
        </div>
        {filtered.length ? <div className="product-grid">{filtered.map((p, idx) => <article className="product-card" key={p.id}>
          <div className="product-image-wrap">
            <img src={p.image_url} alt={p.name} loading="lazy" onError={e => { e.currentTarget.src = 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=900&q=80' }}/>
            {idx % 3 === 0 && <span className="product-badge">{idx === 0 ? 'BESTSELLER' : 'EDITOR’S PICK'}</span>}
            <button className="wishlist-button" title="Wishlist preview" onClick={() => setNotice('Wishlist is a planned next feature.')}><Heart size={18}/></button>
            <button className="quick-add" onClick={() => addToCart(p)}><Plus size={16}/> Add to bag</button>
          </div>
          <div className="product-info"><div className="product-meta"><span>{p.category}</span><span className="rating"><Star size={12} fill="currentColor"/> {p.rating}</span></div><h3>{p.name}</h3><p className="product-description">{p.description}</p><div className="price-row"><strong>{money(p.price)}</strong>{p.original_price && <del>{money(p.original_price)}</del>}{p.original_price && <span className="discount">{Math.round((1-p.price/p.original_price)*100)}% off</span>}</div></div>
        </article>)}</div> : <div className="empty-results"><Search size={24}/><h3>No matches just yet</h3><p>Try another search or browse all of our good things.</p><button className="primary-button" onClick={() => { setSearch(''); setCategory('All') }}>Clear filters</button></div>}
      </section>

      <section className="editorial">
        <div className="editorial-image"><img src="https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=1200&q=85" alt="A calm, considered home interior"/></div>
        <div className="editorial-copy"><span className="eyebrow">OUR POINT OF VIEW</span><h2>Less, but<br/><em>lovelier.</em></h2><p>We believe the things you bring into your life should earn their place in it. Useful, beautiful, made to be lived with. That’s the ShopNova way.</p><a href="#shop" className="text-link">Shop with intention <ArrowRight size={16}/></a><span className="editorial-stamp">THE NOVA<br/>STANDARD <Sparkles size={17}/></span></div>
      </section>

      <section className="newsletter"><div><span className="eyebrow">A GOOD EMAIL, OCCASIONALLY</span><h2>A little something<br/><em>for your inbox.</em></h2><p>New finds, thoughtful ideas, and first dibs. Never noise.</p></div><form onSubmit={e => { e.preventDefault(); setNotice('Thanks — newsletter signup is a UI demo for now.'); e.currentTarget.reset() }}><label htmlFor="newsletter-email">Your email address</label><div className="newsletter-input"><input id="newsletter-email" type="email" placeholder="you@example.com" required/><button aria-label="Subscribe"><ArrowRight size={19}/></button></div><small>By subscribing, you agree to our privacy policy.</small></form></section>
    </main>

    <footer className="footer"><a href="#" className="brand"><span className="brand-mark">s<span>.</span></span><span>shopnova</span></a><p>Everyday essentials. A little more considered.</p><div className="footer-links"><a href="#shop">Shop</a><a href="#values">Our values</a><button onClick={() => setNotice('Privacy and terms pages can be added before production launch.')}>Privacy & terms</button></div><small>© 2026 ShopNova. A demo storefront built for a DevOps project.</small></footer>

    {notice && <div className="toast" role="status"><span className="toast-icon"><Check size={15}/></span>{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={16}/></button></div>}

    {cartOpen && <div className="overlay" onMouseDown={e => e.target === e.currentTarget && setCartOpen(false)}><aside className="side-drawer"><div className="drawer-head"><div><span className="eyebrow">YOUR GOOD FINDS</span><h2>Your bag <span>({cartCount})</span></h2></div><button className="icon-button" onClick={() => setCartOpen(false)}><X/></button></div>
      {!token ? <div className="drawer-empty"><ShoppingBag size={36}/><h3>Your bag is waiting</h3><p>Sign in to keep your picks close and ready.</p><button className="primary-button" onClick={() => { setCartOpen(false); setAuthOpen(true) }}>Sign in to continue</button></div> :
      cart.length === 0 ? <div className="drawer-empty"><ShoppingBag size={36}/><h3>Nothing in your bag. Yet.</h3><p>Great finds are just a little scroll away.</p><button className="primary-button" onClick={() => setCartOpen(false)}>Keep exploring</button></div> :
      <><div className="cart-items">{cart.map(item => <div className="cart-item" key={item.id}><img src={item.product.image_url} alt=""/><div className="cart-item-copy"><span>{item.product.category}</span><strong>{item.product.name}</strong><b>{money(item.product.price)}</b><div className="quantity-control"><button onClick={() => changeQuantity(item, item.quantity - 1)} aria-label="Decrease quantity"><Minus size={13}/></button><span>{item.quantity}</span><button onClick={() => changeQuantity(item, item.quantity + 1)} aria-label="Increase quantity"><Plus size={13}/></button></div></div><button className="remove-item" onClick={() => changeQuantity(item, 0)} aria-label="Remove item"><X size={16}/></button></div>)}</div>
      <div className="cart-summary"><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div><p>Shipping and taxes calculated at checkout.</p><button className="primary-button checkout-button" onClick={checkout}>Place demo order <ArrowRight size={17}/></button><small>Demo checkout only — no payment is collected.</small></div></>}
    </aside></div>}

    {authOpen && <div className="overlay modal-overlay" onMouseDown={e => e.target === e.currentTarget && setAuthOpen(false)}><section className="auth-modal"><button className="icon-button modal-close" onClick={() => setAuthOpen(false)}><X/></button><div className="auth-logo"><span className="brand-mark">s<span>.</span></span></div><span className="eyebrow">{authMode === 'login' ? 'GOOD TO HAVE YOU BACK' : 'YOUR NEXT FAVOURITE AWAITS'}</span><h2>{authMode === 'login' ? 'Welcome back.' : 'Make yourself at home.'}</h2><p>{authMode === 'login' ? 'Sign in to pick up where you left off.' : 'Create an account and keep your good finds together.'}</p>
      <form onSubmit={submitAuth} className="auth-form">{authMode === 'register' && <label>Your name<input name="name" placeholder="How should we call you?" required minLength="2"/></label>}<label>Email address<input type="email" name="email" placeholder="you@example.com" required autoComplete="email"/></label><label>Password<input type="password" name="password" placeholder="At least 8 characters" required minLength="8" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}/></label><button className="primary-button auth-submit" disabled={busy}>{busy ? 'One moment...' : authMode === 'login' ? 'Sign in' : 'Create account'} <ArrowRight size={17}/></button></form>
      <div className="auth-switch">{authMode === 'login' ? 'New around here?' : 'Already have an account?'} <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>{authMode === 'login' ? 'Create an account' : 'Sign in'}</button></div><small className="auth-disclaimer">Demo application. Use a test password, not a password you use elsewhere.</small>
    </section></div>}

    {ordersOpen && <div className="overlay modal-overlay" onMouseDown={e => e.target === e.currentTarget && setOrdersOpen(false)}><section className="orders-modal"><div className="drawer-head"><div><span className="eyebrow">YOUR SHOPNOVA HISTORY</span><h2>Your orders</h2></div><button className="icon-button" onClick={() => setOrdersOpen(false)}><X/></button></div>{orders.length ? <div className="orders-list">{orders.map(o => <article className="order-card" key={o.id}><div><strong>Order #{o.id}</strong><span>{o.created_at ? new Date(o.created_at).toLocaleDateString() : 'Just now'}</span></div><b>{money(o.total)}</b><small>{o.items.map(i => `${i.name} × ${i.quantity}`).join(' · ')}</small><span className="order-status"><Check size={13}/>{o.status}</span></article>)}</div> : <div className="drawer-empty"><PackageCheck size={34}/><h3>No orders yet</h3><p>Your next good find is out there.</p><button className="primary-button" onClick={() => setOrdersOpen(false)}>Explore the store</button></div>}</section></div>}
  </div>
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>)
