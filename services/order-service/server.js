const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3003;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/coffee-orders';
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002';
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3004';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005';

mongoose.connect(MONGO_URI)
  .then(() => console.log('Order Service: Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const OrderSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  items: [{
    productId: String,
    name: String,
    quantity: Number,
    price: Number
  }],
  totalAmount: Number,
  status: { 
    type: String, 
    default: 'pending',
    enum: ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled']
  },
  paymentStatus: { 
    type: String, 
    default: 'pending',
    enum: ['pending', 'completed', 'failed', 'refunded']
  },
  deliveryAddress: String,
  specialInstructions: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', OrderSchema);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'order-service' });
});

// Create order
app.post('/api/orders', async (req, res) => {
  try {
    const { userId, items, deliveryAddress, specialInstructions } = req.body;
    
    // Validate and fetch product details
    let totalAmount = 0;
    const orderItems = [];
    
    for (const item of items) {
      try {
        const response = await axios.get(`${PRODUCT_SERVICE_URL}/api/products/${item.productId}`);
        const product = response.data;
        
        if (!product.available) {
          return res.status(400).json({ error: `${product.name} is not available` });
        }
        
        orderItems.push({
          productId: product._id,
          name: product.name,
          quantity: item.quantity,
          price: product.price
        });
        
        totalAmount += product.price * item.quantity;
      } catch (error) {
        console.error('Product fetch error:', error.message);
        return res.status(400).json({ error: `Invalid product: ${item.productId}` });
      }
    }
    
    // Create order
    const order = new Order({ 
      userId, 
      items: orderItems, 
      totalAmount,
      deliveryAddress,
      specialInstructions
    });
    await order.save();
    
    // Trigger payment service (async)
    axios.post(`${PAYMENT_SERVICE_URL}/api/payments`, {
      orderId: order._id,
      amount: totalAmount,
      userId
    }).catch(err => console.error('Payment service error:', err.message));
    
    res.status(201).json(order);
  } catch (error) {
    console.error('Create order error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get all orders
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort('-createdAt');
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get orders by user
app.get('/api/orders/user/:userId', async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.params.userId }).sort('-createdAt');
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get order by ID
app.get('/api/orders/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update order status
app.patch('/api/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status, updatedAt: new Date() },
      { new: true }
    );
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Send notification (async)
    axios.post(`${NOTIFICATION_SERVICE_URL}/api/notifications`, {
      userId: order.userId,
      message: `Your order #${order._id.toString().slice(-6)} is now ${status}`,
      type: 'order_update',
      orderId: order._id
    }).catch(err => console.error('Notification service error:', err.message));
    
    res.json(order);
  } catch (error) {
    console.error('Update status error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Update payment status
app.patch('/api/orders/:id/payment', async (req, res) => {
  try {
    const { paymentStatus } = req.body;
    
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { paymentStatus, updatedAt: new Date() },
      { new: true }
    );
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // If payment completed, update order status
    if (paymentStatus === 'completed' && order.status === 'pending') {
      order.status = 'confirmed';
      await order.save();
      
      // Send notification
      axios.post(`${NOTIFICATION_SERVICE_URL}/api/notifications`, {
        userId: order.userId,
        message: `Payment confirmed for order #${order._id.toString().slice(-6)}`,
        type: 'payment_success',
        orderId: order._id
      }).catch(err => console.error('Notification service error:', err.message));
    }
    
    res.json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Cancel order
app.post('/api/orders/:id/cancel', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    if (['preparing', 'ready', 'completed'].includes(order.status)) {
      return res.status(400).json({ error: 'Cannot cancel order in current status' });
    }
    
    order.status = 'cancelled';
    order.updatedAt = new Date();
    await order.save();
    
    res.json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Order service running on port ${PORT}`);
});