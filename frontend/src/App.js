import React, { useState, useEffect } from 'react';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

function App() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [view, setView] = useState('products'); // products, cart, orders, notifications
  const [loading, setLoading] = useState(false);

  // Auth form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegister, setIsRegister] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchUserProfile(token);
    }
    fetchProducts();
  }, []);

  useEffect(() => {
    if (user) {
      fetchOrders();
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 10000); // Poll every 10s
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/products`);
      const data = await res.json();
      setProducts(data);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchUserProfile = async (token) => {
    try {
      const res = await fetch(`${API_URL}/api/users/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        localStorage.removeItem('token');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/orders/user/${user._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setOrders(data);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/notifications/user/${user._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setNotifications(data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = isRegister ? '/api/users/register' : '/api/users/login';
      const body = isRegister 
        ? { email, password, name } 
        : { email, password };

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (res.ok) {
        if (isRegister) {
          alert('Registration successful! Please login.');
          setIsRegister(false);
        } else {
          localStorage.setItem('token', data.token);
          setUser(data.user);
          setEmail('');
          setPassword('');
        }
      } else {
        alert(data.error || 'Authentication failed');
      }
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setOrders([]);
    setNotifications([]);
    setCart([]);
  };

  const addToCart = (product) => {
    const existing = cart.find(item => item._id === product._id);
    if (existing) {
      setCart(cart.map(item => 
        item._id === product._id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item._id !== productId));
  };

  const updateQuantity = (productId, delta) => {
    setCart(cart.map(item => {
      if (item._id === productId) {
        const newQuantity = item.quantity + delta;
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const placeOrder = async () => {
    if (!user) {
      alert('Please login first');
      return;
    }

    if (cart.length === 0) {
      alert('Cart is empty');
      return;
    }

    setLoading(true);

    const items = cart.map(item => ({
      productId: item._id,
      quantity: item.quantity
    }));

    try {
      const res = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          userId: user._id,
          items,
          deliveryAddress: '123 Coffee St'
        })
      });

      if (res.ok) {
        alert('Order placed successfully!');
        setCart([]);
        fetchOrders();
        setView('orders');
      } else {
        const data = await res.json();
        alert(data.error || 'Order failed');
      }
    } catch (error) {
      alert('Error placing order: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const markNotificationRead = async (id) => {
    try {
      await fetch(`${API_URL}/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      fetchNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const getTotalPrice = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="App">
      <h1>☕ Coffee Shop</h1>
      {user ? (
        <div>
          Welcome, {user.name}!
          <button onClick={logout}>Logout</button>
        </div>
      ) : null}

      {!user ? (
        <form onSubmit={handleAuth} className="auth-form">
          <h2>{isRegister ? 'Register' : 'Login'}</h2>
          {isRegister && (
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Loading...' : (isRegister ? 'Register' : 'Login')}
          </button>
          <div>
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button type="button" onClick={() => setIsRegister(!isRegister)}>
              {isRegister ? 'Login' : 'Register'}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="nav">
            <button
              className={view === 'products' ? 'active' : ''}
              onClick={() => setView('products')}
            >
              Products
            </button>
            <button
              className={view === 'cart' ? 'active' : ''}
              onClick={() => setView('cart')}
            >
              Cart ({cart.length})
            </button>
            <button
              className={view === 'orders' ? 'active' : ''}
              onClick={() => setView('orders')}
            >
              Orders ({orders.length})
            </button>
            <button
              className={view === 'notifications' ? 'active' : ''}
              onClick={() => setView('notifications')}
            >
              Notifications {unreadCount > 0 && `(${unreadCount})`}
            </button>
          </div>

          {view === 'products' && (
            <div className="products">
              <h2>Our Menu</h2>
              <div className="product-list">
                {products.map(product => (
                  <div key={product._id} className="product">
                    <h3>{product.name}</h3>
                    <p>{product.description}</p>
                    <p>{product.category}</p>
                    <p>${product.price.toFixed(2)}</p>
                    <button onClick={() => addToCart(product)}>
                      Add to Cart
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'cart' && (
            <div className="cart">
              <h2>Shopping Cart</h2>
              {cart.length === 0 ? (
                <p>Your cart is empty</p>
              ) : (
                <>
                  <div className="cart-list">
                    {cart.map(item => (
                      <div key={item._id} className="cart-item">
                        <span>{item.name}</span>
                        <span>${item.price.toFixed(2)} each</span>
                        <button onClick={() => updateQuantity(item._id, -1)}>-</button>
                        <span>{item.quantity}</span>
                        <button onClick={() => updateQuantity(item._id, 1)}>+</button>
                        <button onClick={() => removeFromCart(item._id)}>Remove</button>
                        <span>${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="cart-total">
                    Total: ${getTotalPrice()}
                  </div>
                  <button onClick={placeOrder} disabled={loading}>
                    {loading ? 'Placing Order...' : 'Place Order'}
                  </button>
                </>
              )}
            </div>
          )}

          {view === 'orders' && (
            <div className="orders">
              <h2>My Orders</h2>
              {orders.length === 0 ? (
                <p>No orders yet</p>
              ) : (
                <div className="order-list">
                  {orders.map(order => (
                    <div key={order._id} className="order">
                      <h3>Order #{order._id.slice(-6)}</h3>
                      <p>Status: {order.status}</p>
                      <div className="order-items">
                        {order.items.map((item, i) => (
                          <div key={i}>
                            {item.name} x {item.quantity} - ${(item.price * item.quantity).toFixed(2)}
                          </div>
                        ))}
                      </div>
                      <p>Total: ${order.totalAmount.toFixed(2)}</p>
                      <p>Payment: {order.paymentStatus}</p>
                      <p>{new Date(order.createdAt).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === 'notifications' && (
            <div className="notifications">
              <h2>Notifications</h2>
              {notifications.length === 0 ? (
                <p>No notifications</p>
              ) : (
                <div className="notification-list">
                  {notifications.map(notif => (
                    <div
                      key={notif._id}
                      className={`notification ${notif.read ? 'read' : 'unread'}`}
                      onClick={() => !notif.read && markNotificationRead(notif._id)}
                    >
                      <p>{notif.message}</p>
                      <span>{new Date(notif.createdAt).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;