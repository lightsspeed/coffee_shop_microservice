const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3004;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/coffee-payments';
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:3003';

mongoose.connect(MONGO_URI)
  .then(() => console.log('Payment Service: Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const PaymentSchema = new mongoose.Schema({
  orderId: { type: String, required: true },
  userId: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { 
    type: String, 
    default: 'pending',
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded']
  },
  paymentMethod: { 
    type: String,
    enum: ['card', 'cash', 'upi', 'wallet']
  },
  transactionId: String,
  failureReason: String,
  createdAt: { type: Date, default: Date.now },
  completedAt: Date
});

const Payment = mongoose.model('Payment', PaymentSchema);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'payment-service' });
});

// Process payment
app.post('/api/payments', async (req, res) => {
  try {
    const { orderId, amount, userId, paymentMethod = 'card' } = req.body;
    
    const payment = new Payment({
      orderId,
      userId,
      amount,
      paymentMethod,
      status: 'processing'
    });
    
    await payment.save();
    
    // Simulate payment processing
    setTimeout(async () => {
      try {
        // Simulate 95% success rate
        const isSuccess = Math.random() > 0.05;
        
        if (isSuccess) {
          payment.status = 'completed';
          payment.transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
          payment.completedAt = new Date();
        } else {
          payment.status = 'failed';
          payment.failureReason = 'Insufficient funds';
        }
        
        await payment.save();
        
        // Update order payment status
        await axios.patch(`${ORDER_SERVICE_URL}/api/orders/${orderId}/payment`, {
          paymentStatus: payment.status
        });
        
      } catch (error) {
        console.error('Payment processing error:', error.message);
      }
    }, 2000); // 2 second delay to simulate processing
    
    res.status(201).json(payment);
  } catch (error) {
    console.error('Payment creation error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get payment by order ID
app.get('/api/payments/order/:orderId', async (req, res) => {
  try {
    const payment = await Payment.findOne({ orderId: req.params.orderId });
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    res.json(payment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get payment by ID
app.get('/api/payments/:id', async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    res.json(payment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get payments by user
app.get('/api/payments/user/:userId', async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.params.userId }).sort('-createdAt');
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Refund payment
app.post('/api/payments/:id/refund', async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    if (payment.status !== 'completed') {
      return res.status(400).json({ error: 'Can only refund completed payments' });
    }
    
    payment.status = 'refunded';
    await payment.save();
    
    // Update order
    await axios.patch(`${ORDER_SERVICE_URL}/api/orders/${payment.orderId}/payment`, {
      paymentStatus: 'refunded'
    });
    
    res.json(payment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Payment service running on port ${PORT}`);
});