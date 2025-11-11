const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3002;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/coffee-products';

mongoose.connect(MONGO_URI)
  .then(() => console.log('Product Service: Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  category: { type: String, enum: ['coffee', 'tea', 'pastry', 'snack'], required: true },
  image: String,
  available: { type: Boolean, default: true },
  ingredients: [String],
  calories: Number,
  createdAt: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', ProductSchema);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'product-service' });
});

// Get all products
app.get('/api/products', async (req, res) => {
  try {
    const { category, available } = req.query;
    const filter = {};
    
    if (category) filter.category = category;
    if (available !== undefined) filter.available = available === 'true';
    
    const products = await Product.find(filter).sort('name');
    res.json(products);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get product by ID
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create product
app.post('/api/products', async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Update product
app.put('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete product
app.delete('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update product availability
app.patch('/api/products/:id/availability', async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { available: req.body.available },
      { new: true }
    );
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Seed initial products (for testing)
app.post('/api/products/seed', async (req, res) => {
  try {
    const products = [
      {
        name: 'Espresso',
        description: 'Strong and bold coffee shot',
        price: 2.99,
        category: 'coffee',
        available: true,
        calories: 5
      },
      {
        name: 'Cappuccino',
        description: 'Espresso with steamed milk foam',
        price: 4.99,
        category: 'coffee',
        available: true,
        calories: 120
      },
      {
        name: 'Latte',
        description: 'Espresso with steamed milk',
        price: 4.49,
        category: 'coffee',
        available: true,
        calories: 190
      },
      {
        name: 'Croissant',
        description: 'Fresh buttery croissant',
        price: 3.49,
        category: 'pastry',
        available: true,
        calories: 231
      }
    ];
    
    await Product.deleteMany({});
    await Product.insertMany(products);
    res.json({ message: 'Products seeded successfully', count: products.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Product service running on port ${PORT}`);
});