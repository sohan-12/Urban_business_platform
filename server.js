const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db');
const { verifyToken, isAdmin, isShopkeeper, isAdminOrShopkeeper } = require('./middleware/auth');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey1234567890';

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ----------------------------------------------------
// AUTHENTICATION ROUTES
// ----------------------------------------------------

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required.' });
  }

  try {
    // Check if user already exists
    const userCheck = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ message: 'User with this email already exists.' });
    }

    // Set default role if not provided
    const targetRole = role ? role.toLowerCase() : 'user';
    const targetStatus = targetRole === 'shopkeeper' ? 'pending' : 'approved';
    
    // Hash password
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    // Extract shopkeeper additional details if role is shopkeeper
    let shopName = null;
    let shopAddress = null;
    let ownershipType = null;
    let licenseNumber = null;
    let businessPhone = null;
    let shopCategory = null;

    if (targetRole === 'shopkeeper') {
      shopName = req.body.shop_name || null;
      shopAddress = req.body.shop_address || null;
      ownershipType = req.body.ownership_type || null;
      licenseNumber = req.body.license_number || null;
      businessPhone = req.body.business_phone || null;
      shopCategory = req.body.shop_category || null;

      // Validate required fields for shopkeeper
      if (!shopName || !shopAddress || !ownershipType || !shopCategory) {
        return res.status(400).json({ message: 'Shop name, shop address, category, and ownership type are required for shopkeeper registration.' });
      }
    }

    // Insert user
    const result = await db.query(
      `INSERT INTO users (name, email, password, role, shop_name, shop_address, ownership_type, license_number, business_phone, status, shop_category) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
       RETURNING id, name, email, role, shop_name, shop_address, ownership_type, license_number, business_phone, status, shop_category`,
      [name, email.toLowerCase(), hashedPassword, targetRole, shopName, shopAddress, ownershipType, licenseNumber, businessPhone, targetStatus, shopCategory]
    );

    const user = result.rows[0];

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User registered successfully.',
      token,
      user
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    // Check user
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    const user = result.rows[0];

    // Compare passwords
    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        shop_name: user.shop_name,
        shop_address: user.shop_address,
        ownership_type: user.ownership_type,
        license_number: user.license_number,
        business_phone: user.business_phone,
        status: user.status,
        shop_category: user.shop_category
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', verifyToken, async (req, res) => {
  try {
    const result = await db.query('SELECT id, name, email, role, status, shop_name, shop_address, ownership_type, license_number, business_phone, shop_category FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Fetch me error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/auth/shopkeepers (Admin only)
app.get('/api/auth/shopkeepers', verifyToken, isAdmin, async (req, res) => {
  try {
    const result = await db.query("SELECT id, name, email, shop_name, shop_address, ownership_type, license_number, business_phone FROM users WHERE LOWER(role) = 'shopkeeper' ORDER BY name ASC");
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch shopkeepers error:', error);
    res.status(500).json({ message: 'Server error fetching shopkeepers.' });
  }
});


// ----------------------------------------------------
// BUSINESSES ROUTES
// ----------------------------------------------------

// GET /api/businesses (Public / Users)
app.get('/api/businesses', async (req, res) => {
  const { search, category } = req.query;
  let queryText = `
    SELECT b.*, 
           COALESCE(AVG(r.rating), 0)::numeric(10,1) as avg_rating, 
           COUNT(r.id)::int as review_count,
           u.name as owner_name
    FROM businesses b
    LEFT JOIN reviews r ON b.id = r.business_id
    LEFT JOIN users u ON b.owner_id = u.id
  `;
  
  const queryParams = [];
  const clauses = [];

  if (category) {
    queryParams.push(category);
    clauses.push(`LOWER(b.category) = LOWER($${queryParams.length})`);
  }

  if (search) {
    queryParams.push(`%${search}%`);
    const sIndex = queryParams.length;
    clauses.push(`(
      b.name ILIKE $${sIndex} OR 
      b.description ILIKE $${sIndex} OR 
      b.address ILIKE $${sIndex} OR
      b.category ILIKE $${sIndex}
    )`);
  }

  if (clauses.length > 0) {
    queryText += ` WHERE ${clauses.join(' AND ')}`;
  }

  queryText += ` GROUP BY b.id, u.name ORDER BY b.name ASC`;

  try {
    const result = await db.query(queryText, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch businesses error:', error);
    res.status(500).json({ message: 'Server error fetching businesses.' });
  }
});

// GET /api/my-businesses (Shopkeeper only)
app.get('/api/my-businesses', verifyToken, isShopkeeper, async (req, res) => {
  try {
    const queryText = `
      SELECT b.*, 
             COALESCE(AVG(r.rating), 0)::numeric(10,1) as avg_rating, 
             COUNT(r.id)::int as review_count
      FROM businesses b
      LEFT JOIN reviews r ON b.id = r.business_id
      WHERE b.owner_id = $1
      GROUP BY b.id
      ORDER BY b.name ASC
    `;
    const result = await db.query(queryText, [req.user.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch my-businesses error:', error);
    res.status(500).json({ message: 'Server error fetching your businesses.' });
  }
});

// GET /api/businesses/:id (Detailed business profile)
app.get('/api/businesses/:id', async (req, res) => {
  const businessId = req.params.id;

  try {
    // 1. Fetch business details
    const bizRes = await db.query(`
      SELECT b.*, 
             COALESCE(AVG(r.rating), 0)::numeric(10,1) as avg_rating, 
             COUNT(r.id)::int as review_count,
             u.name as owner_name,
             u.email as owner_email
      FROM businesses b
      LEFT JOIN reviews r ON b.id = r.business_id
      LEFT JOIN users u ON b.owner_id = u.id
      WHERE b.id = $1
      GROUP BY b.id, u.name, u.email
    `, [businessId]);

    if (bizRes.rows.length === 0) {
      return res.status(404).json({ message: 'Business not found.' });
    }

    const business = bizRes.rows[0];

    // 2. Fetch items for this business
    const itemsRes = await db.query('SELECT * FROM items WHERE business_id = $1 ORDER BY name ASC', [businessId]);
    business.items = itemsRes.rows;

    // 3. Fetch reviews for this business
    const reviewsRes = await db.query(`
      SELECT r.id, r.user_id, r.rating, r.comment, r.created_at, u.name as user_name
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.business_id = $1
      ORDER BY r.created_at DESC
    `, [businessId]);
    business.reviews = reviewsRes.rows;

    res.json(business);
  } catch (error) {
    console.error('Fetch business by id error:', error);
    res.status(500).json({ message: 'Server error fetching business details.' });
  }
});

// POST /api/businesses (Admin only)
app.post('/api/businesses', verifyToken, isAdmin, async (req, res) => {
  const { name, category, description, address, phone, price_range, latitude, longitude, owner_id } = req.body;

  if (!name || !category || !address) {
    return res.status(400).json({ message: 'Name, category, and address are required.' });
  }

  try {
    const queryText = `
      INSERT INTO businesses (name, category, description, address, phone, price_range, latitude, longitude, owner_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const result = await db.query(queryText, [
      name,
      category,
      description || null,
      address,
      phone || null,
      price_range || '$$',
      latitude || 0,
      longitude || 0,
      owner_id || null
    ]);

    // Log admin action
    await db.query('INSERT INTO admin_logs (admin_id, action) VALUES ($1, $2)', [
      req.user.id,
      `Added business listing: "${name}"`
    ]);

    res.status(201).json({
      message: 'Business added successfully.',
      business: result.rows[0]
    });
  } catch (error) {
    console.error('Create business error:', error);
    res.status(500).json({ message: 'Server error creating business listing.' });
  }
});

// PUT /api/businesses/:id (Admin only)
app.put('/api/businesses/:id', verifyToken, isAdmin, async (req, res) => {
  const businessId = req.params.id;
  const { name, category, description, address, phone, price_range, latitude, longitude, owner_id } = req.body;

  if (!name || !category || !address) {
    return res.status(400).json({ message: 'Name, category, and address are required.' });
  }

  try {
    // Check if business exists
    const checkRes = await db.query('SELECT * FROM businesses WHERE id = $1', [businessId]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ message: 'Business not found.' });
    }

    const queryText = `
      UPDATE businesses 
      SET name = $1, category = $2, description = $3, address = $4, phone = $5, 
          price_range = $6, latitude = $7, longitude = $8, owner_id = $9
      WHERE id = $10
      RETURNING *
    `;
    const result = await db.query(queryText, [
      name,
      category,
      description,
      address,
      phone,
      price_range,
      latitude,
      longitude,
      owner_id || null,
      businessId
    ]);

    // Log admin action
    await db.query('INSERT INTO admin_logs (admin_id, action) VALUES ($1, $2)', [
      req.user.id,
      `Updated business listing ID ${businessId}: "${name}"`
    ]);

    res.json({
      message: 'Business updated successfully.',
      business: result.rows[0]
    });
  } catch (error) {
    console.error('Update business error:', error);
    res.status(500).json({ message: 'Server error updating business listing.' });
  }
});

// DELETE /api/businesses/:id (Admin only)
app.delete('/api/businesses/:id', verifyToken, isAdmin, async (req, res) => {
  const businessId = req.params.id;

  try {
    // Get business name for logging
    const checkRes = await db.query('SELECT name FROM businesses WHERE id = $1', [businessId]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ message: 'Business not found.' });
    }
    const bizName = checkRes.rows[0].name;

    await db.query('DELETE FROM businesses WHERE id = $1', [businessId]);

    // Log admin action
    await db.query('INSERT INTO admin_logs (admin_id, action) VALUES ($1, $2)', [
      req.user.id,
      `Deleted business listing: "${bizName}" (ID ${businessId})`
    ]);

    res.json({ message: 'Business deleted successfully.' });
  } catch (error) {
    console.error('Delete business error:', error);
    res.status(500).json({ message: 'Server error deleting business listing.' });
  }
});


// ----------------------------------------------------
// ITEMS / PRODUCTS ROUTES
// ----------------------------------------------------

// POST /api/businesses/:id/items (Shopkeeper who owns it, or Admin)
app.post('/api/businesses/:id/items', verifyToken, isAdminOrShopkeeper, async (req, res) => {
  const businessId = req.params.id;
  const { name, description, price, image_url } = req.body;

  if (!name || price === undefined) {
    return res.status(400).json({ message: 'Item name and price are required.' });
  }

  try {
    // 1. Verify business existence and ownership
    const bizRes = await db.query('SELECT * FROM businesses WHERE id = $1', [businessId]);
    if (bizRes.rows.length === 0) {
      return res.status(404).json({ message: 'Business not found.' });
    }

    const business = bizRes.rows[0];
    const isUserAdmin = req.user.role.toLowerCase() === 'admin';

    if (!isUserAdmin && business.owner_id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied. You do not own this business listing.' });
    }

    // 2. Insert item
    const result = await db.query(
      'INSERT INTO items (business_id, name, description, price, image_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [businessId, name, description || null, price, image_url || null]
    );

    res.status(201).json({
      message: 'Item added successfully.',
      item: result.rows[0]
    });
  } catch (error) {
    console.error('Add item error:', error);
    res.status(500).json({ message: 'Server error adding item.' });
  }
});

// PUT /api/items/:itemId (Shopkeeper or Admin)
app.put('/api/items/:itemId', verifyToken, isAdminOrShopkeeper, async (req, res) => {
  const itemId = req.params.itemId;
  const { name, description, price, image_url } = req.body;

  if (!name || price === undefined) {
    return res.status(400).json({ message: 'Item name and price are required.' });
  }

  try {
    // 1. Check if item exists and fetch its parent business
    const itemRes = await db.query(`
      SELECT i.*, b.owner_id 
      FROM items i
      JOIN businesses b ON i.business_id = b.id
      WHERE i.id = $1
    `, [itemId]);

    if (itemRes.rows.length === 0) {
      return res.status(404).json({ message: 'Item not found.' });
    }

    const item = itemRes.rows[0];
    const isUserAdmin = req.user.role.toLowerCase() === 'admin';

    if (!isUserAdmin && item.owner_id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied. You do not own the business associated with this item.' });
    }

    // 2. Update item
    const result = await db.query(
      'UPDATE items SET name = $1, description = $2, price = $3, image_url = $4 WHERE id = $5 RETURNING *',
      [name, description, price, image_url || null, itemId]
    );

    res.json({
      message: 'Item updated successfully.',
      item: result.rows[0]
    });
  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({ message: 'Server error updating item.' });
  }
});

// DELETE /api/items/:itemId (Shopkeeper or Admin)
app.delete('/api/items/:itemId', verifyToken, isAdminOrShopkeeper, async (req, res) => {
  const itemId = req.params.itemId;

  try {
    // 1. Check if item exists and fetch ownership details
    const itemRes = await db.query(`
      SELECT i.*, b.owner_id 
      FROM items i
      JOIN businesses b ON i.business_id = b.id
      WHERE i.id = $1
    `, [itemId]);

    if (itemRes.rows.length === 0) {
      return res.status(404).json({ message: 'Item not found.' });
    }

    const item = itemRes.rows[0];
    const isUserAdmin = req.user.role.toLowerCase() === 'admin';

    if (!isUserAdmin && item.owner_id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied. You do not own the business associated with this item.' });
    }

    // 2. Delete item
    await db.query('DELETE FROM items WHERE id = $1', [itemId]);

    res.json({ message: 'Item deleted successfully.' });
  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({ message: 'Server error deleting item.' });
  }
});


// ----------------------------------------------------
// REVIEWS ROUTES
// ----------------------------------------------------

// POST /api/businesses/:id/reviews (Customer/Any authenticated user)
app.post('/api/businesses/:id/reviews', verifyToken, async (req, res) => {
  const businessId = req.params.id;
  const { rating, comment } = req.body;
  const userId = req.user.id;

  if (rating === undefined || rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'Rating is required and must be between 1 and 5.' });
  }

  try {
    // Check if business exists
    const bizCheck = await db.query('SELECT name FROM businesses WHERE id = $1', [businessId]);
    if (bizCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Business not found.' });
    }

    // Insert or Update (upsert) review based on unique constraint (user_id, business_id)
    const queryText = `
      INSERT INTO reviews (user_id, business_id, rating, comment)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, business_id) 
      DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, created_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await db.query(queryText, [userId, businessId, rating, comment || null]);

    res.status(201).json({
      message: 'Review submitted successfully.',
      review: result.rows[0]
    });
  } catch (error) {
    console.error('Submit review error:', error);
    res.status(500).json({ message: 'Server error submitting review.' });
  }
});


// ----------------------------------------------------
// ADMIN STATISTICS ROUTES
// ----------------------------------------------------

// GET /api/admin/stats (Admin only)
app.get('/api/admin/stats', verifyToken, isAdmin, async (req, res) => {
  try {
    const shopCountRes = await db.query('SELECT COUNT(*)::int as count FROM businesses');
    const itemCountRes = await db.query('SELECT COUNT(*)::int as count FROM items');
    const reviewCountRes = await db.query('SELECT COUNT(*)::int as count FROM reviews');
    
    const userRolesRes = await db.query(`
      SELECT role, COUNT(*)::int as count 
      FROM users 
      GROUP BY role
    `);

    // Normalize roles to count admin, shopkeepers, and users
    let adminsCount = 0;
    let shopkeepersCount = 0;
    let customersCount = 0;

    userRolesRes.rows.forEach(row => {
      const roleStr = (row.role || '').toLowerCase();
      if (roleStr === 'admin') {
        adminsCount += row.count;
      } else if (roleStr === 'shopkeeper') {
        shopkeepersCount += row.count;
      } else {
        customersCount += row.count;
      }
    });

    res.json({
      totalBusinesses: shopCountRes.rows[0].count,
      totalItems: itemCountRes.rows[0].count,
      totalReviews: reviewCountRes.rows[0].count,
      users: {
        admins: adminsCount,
        shopkeepers: shopkeepersCount,
        customers: customersCount,
        total: adminsCount + shopkeepersCount + customersCount
      }
    });
  } catch (error) {
    console.error('Fetch admin stats error:', error);
    res.status(500).json({ message: 'Server error generating statistics.' });
  }
});

// GET /api/business-requests/my-request (Shopkeeper only - checks if they have a pending listing)
app.get('/api/business-requests/my-request', verifyToken, isShopkeeper, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM business_requests WHERE shopkeeper_id = $1 AND status = 'pending' LIMIT 1",
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.json(null);
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Fetch my-request error:', error);
    res.status(500).json({ message: 'Server error checking shop registration requests.' });
  }
});

// POST /api/business-requests (Shopkeeper only - submits a new listing request)
app.post('/api/business-requests', verifyToken, isShopkeeper, async (req, res) => {
  const { name, category, description, address, phone, price_range, latitude, longitude, items } = req.body;

  if (!name || !category || !address || !items) {
    return res.status(400).json({ message: 'Shop name, category, address, and menu items are required.' });
  }

  try {
    // Check if they already have a pending request
    const checkPending = await db.query(
      "SELECT id FROM business_requests WHERE shopkeeper_id = $1 AND status = 'pending'",
      [req.user.id]
    );
    if (checkPending.rows.length > 0) {
      return res.status(400).json({ message: 'You already have a pending listing request under review.' });
    }

    const itemsJson = JSON.stringify(items);

    const result = await db.query(
      `INSERT INTO business_requests (shopkeeper_id, name, category, description, address, phone, price_range, latitude, longitude, items_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        req.user.id,
        name,
        category,
        description || null,
        address,
        phone || null,
        price_range || '$$',
        latitude || 0.0,
        longitude || 0.0,
        itemsJson
      ]
    );

    res.status(201).json({
      message: 'Shop listing request submitted successfully.',
      request: result.rows[0]
    });
  } catch (error) {
    console.error('Submit shop request error:', error);
    res.status(500).json({ message: 'Server error submitting shop listing request.' });
  }
});

// GET /api/admin/business-requests (Admin only - fetches all pending listing requests)
app.get('/api/admin/business-requests', verifyToken, isAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT br.*, u.name as shopkeeper_name, u.email as shopkeeper_email 
       FROM business_requests br 
       JOIN users u ON br.shopkeeper_id = u.id 
       WHERE br.status = 'pending' 
       ORDER BY br.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch admin pending requests error:', error);
    res.status(500).json({ message: 'Server error fetching listing requests.' });
  }
});

// POST /api/admin/grant-request/:id (Admin only - grants a shopkeeper's request)
app.post('/api/admin/grant-request/:id', verifyToken, isAdmin, async (req, res) => {
  const requestId = req.params.id;

  try {
    // 1. Fetch the request
    const reqRes = await db.query("SELECT * FROM business_requests WHERE id = $1", [requestId]);
    if (reqRes.rows.length === 0) {
      return res.status(404).json({ message: 'Listing request not found.' });
    }

    const request = reqRes.rows[0];
    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'This request is not pending.' });
    }

    // Begin Transaction
    await db.query('BEGIN');

    // 2. Update request status
    await db.query("UPDATE business_requests SET status = 'approved' WHERE id = $1", [requestId]);

    // 3. Create the business listing
    const bizRes = await db.query(
      `INSERT INTO businesses (name, category, description, address, phone, price_range, latitude, longitude, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        request.name,
        request.category,
        request.description,
        request.address,
        request.phone,
        request.price_range,
        request.latitude,
        request.longitude,
        request.shopkeeper_id
      ]
    );

    const businessId = bizRes.rows[0].id;

    // 4. Parse and create proposed items
    let items = [];
    try {
      items = JSON.parse(request.items_json);
    } catch (e) {
      console.error('JSON parsing items error:', e);
    }

    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        if (!item.name || item.price === undefined) continue;
        await db.query(
          "INSERT INTO items (business_id, name, description, price) VALUES ($1, $2, $3, $4)",
          [businessId, item.name, item.description || null, parseFloat(item.price) || 0.0]
        );
      }
    }

    // 5. Log admin action
    await db.query('INSERT INTO admin_logs (admin_id, action) VALUES ($1, $2)', [
      req.user.id,
      `Granted shop request ID ${request.id}: Created business "${request.name}" (ID ${businessId}) and initialized products.`
    ]);

    await db.query('COMMIT');

    res.json({
      message: 'Request granted! Business listing and items created successfully.',
      businessId
    });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Grant request error:', error);
    res.status(500).json({ message: 'Server error granting request.' });
  }
});

// POST /api/admin/decline-request/:id (Admin only - declines/deletes request)
app.post('/api/admin/decline-request/:id', verifyToken, isAdmin, async (req, res) => {
  const requestId = req.params.id;

  try {
    const checkRes = await db.query("SELECT name FROM business_requests WHERE id = $1", [requestId]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ message: 'Request not found.' });
    }
    const reqName = checkRes.rows[0].name;

    // We can delete it so they can request again
    await db.query("DELETE FROM business_requests WHERE id = $1", [requestId]);

    // Log admin action
    await db.query('INSERT INTO admin_logs (admin_id, action) VALUES ($1, $2)', [
      req.user.id,
      `Declined shop listing request for "${reqName}" (Request ID ${requestId})`
    ]);

    res.json({ message: 'Listing request declined and removed.' });
  } catch (error) {
    console.error('Decline request error:', error);
    res.status(500).json({ message: 'Server error declining request.' });
  }
});

// Serve frontend routing fallback (simple fallback for HTML pages)
app.get('*', (req, res, next) => {
  // Let static middleware handle standard files, else redirect/serve homepage
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
