const db = require('./db');
const bcrypt = require('bcryptjs');

async function seed() {
  console.log('Starting database seeding...');

  try {
    // 1. Hash passwords
    const salt = bcrypt.genSaltSync(10);
    const shopkeeperPassword = bcrypt.hashSync('password123', salt);
    const customerPassword = bcrypt.hashSync('password123', salt);
    const adminPassword = bcrypt.hashSync('postgres123', salt); // Default admin

    // 2. Seed Users
    console.log('Seeding users...');
    
    // Check and seed admin Sohan if not exists
    const adminRes = await db.query("SELECT * FROM users WHERE email = 'sohan@gmail.com'");
    let adminId;
    if (adminRes.rows.length === 0) {
      const inserted = await db.query(
        "INSERT INTO users (name, email, password, role) VALUES ('Sohan', 'sohan@gmail.com', $1, 'admin') RETURNING id",
        [adminPassword]
      );
      adminId = inserted.rows[0].id;
      console.log('Created admin user: sohan@gmail.com');
    } else {
      adminId = adminRes.rows[0].id;
      // Update role to lowercase admin just in case
      await db.query("UPDATE users SET role = 'admin' WHERE id = $1", [adminId]);
      console.log('Admin user sohan@gmail.com already exists.');
    }

    // Seed Shopkeeper 1
    const sk1Res = await db.query("SELECT * FROM users WHERE email = 'shopkeeper1@gmail.com'");
    let sk1Id;
    if (sk1Res.rows.length === 0) {
      const inserted = await db.query(
        "INSERT INTO users (name, email, password, role) VALUES ('John Shopkeeper', 'shopkeeper1@gmail.com', $1, 'shopkeeper') RETURNING id",
        [shopkeeperPassword]
      );
      sk1Id = inserted.rows[0].id;
      console.log('Created shopkeeper: shopkeeper1@gmail.com');
    } else {
      sk1Id = sk1Res.rows[0].id;
      console.log('Shopkeeper 1 already exists.');
    }

    // Seed Shopkeeper 2
    const sk2Res = await db.query("SELECT * FROM users WHERE email = 'shopkeeper2@gmail.com'");
    let sk2Id;
    if (sk2Res.rows.length === 0) {
      const inserted = await db.query(
        "INSERT INTO users (name, email, password, role) VALUES ('Jane Shopkeeper', 'shopkeeper2@gmail.com', $1, 'shopkeeper') RETURNING id",
        [shopkeeperPassword]
      );
      sk2Id = inserted.rows[0].id;
      console.log('Created shopkeeper: shopkeeper2@gmail.com');
    } else {
      sk2Id = sk2Res.rows[0].id;
      console.log('Shopkeeper 2 already exists.');
    }

    // Seed Customer 1
    const cust1Res = await db.query("SELECT * FROM users WHERE email = 'customer1@gmail.com'");
    let cust1Id;
    if (cust1Res.rows.length === 0) {
      const inserted = await db.query(
        "INSERT INTO users (name, email, password, role) VALUES ('Alice Customer', 'customer1@gmail.com', $1, 'user') RETURNING id",
        [customerPassword]
      );
      cust1Id = inserted.rows[0].id;
      console.log('Created customer: customer1@gmail.com');
    } else {
      cust1Id = cust1Res.rows[0].id;
      console.log('Customer 1 already exists.');
    }

    // Seed Customer 2
    const cust2Res = await db.query("SELECT * FROM users WHERE email = 'customer2@gmail.com'");
    let cust2Id;
    if (cust2Res.rows.length === 0) {
      const inserted = await db.query(
        "INSERT INTO users (name, email, password, role) VALUES ('Bob Customer', 'customer2@gmail.com', $1, 'user') RETURNING id",
        [customerPassword]
      );
      cust2Id = inserted.rows[0].id;
      console.log('Created customer: customer2@gmail.com');
    } else {
      cust2Id = cust2Res.rows[0].id;
      console.log('Customer 2 already exists.');
    }

    // 3. Seed Categories table (just to have them listed, though businesses column has text category)
    console.log('Seeding categories table...');
    const targetCategories = ['Hotels', 'Restaurants', 'Salons', 'Tiffins', 'Stores', 'Markets', 'Gyms', 'Parlours', 'Cafes', 'Clubs'];
    for (const catName of targetCategories) {
      const catCheck = await db.query("SELECT * FROM categories WHERE name = $1", [catName]);
      if (catCheck.rows.length === 0) {
        await db.query("INSERT INTO categories (name) VALUES ($1)", [catName]);
      }
    }
    console.log('Categories seeded.');

    // 4. Seed Businesses
    console.log('Seeding businesses...');
    const sampleBusinesses = [
      {
        name: 'Iron Fitness',
        category: 'Gyms',
        description: 'A premium fitness center with state-of-the-art gym equipment, cardio zones, and expert personal trainers.',
        address: 'Madhapur, Hyderabad',
        phone: '9999911111',
        price_range: '$$',
        latitude: 17.44830000,
        longitude: 78.37410000,
        owner_id: sk1Id
      },
      {
        name: 'Glow Beauty Parlour',
        category: 'Parlours',
        description: 'Complete beauty salon offering professional haircuts, styling, bridal makeup, facials, and skincare treatments.',
        address: 'Banjara Hills, Hyderabad',
        phone: '9999922222',
        price_range: '$$$',
        latitude: 17.40650000,
        longitude: 78.47720000,
        owner_id: sk2Id
      },
      {
        name: 'Super Mart',
        category: 'Stores',
        description: 'Your friendly neighborhood grocery store. Stocked with fresh produce, dairy, bakery, and daily essentials.',
        address: 'Koti, Hyderabad',
        phone: '9999933333',
        price_range: '$',
        latitude: 17.38500000,
        longitude: 78.48670000,
        owner_id: sk1Id
      },
      {
        name: 'Organic Farmers Market',
        category: 'Markets',
        description: 'Weekly local market presenting 100% certified organic fruits, vegetables, honey, and handmade dairy goods.',
        address: 'Jubilee Hills, Hyderabad',
        phone: '9999944444',
        price_range: '$$',
        latitude: 17.43250000,
        longitude: 78.40120000,
        owner_id: sk2Id
      },
      {
        name: 'Bliss Café',
        category: 'Cafes',
        description: 'A cozy spot for artisanal espresso drinks, gourmet sandwiches, and fresh daily croissants.',
        address: 'Gachibowli, Hyderabad',
        phone: '9999955555',
        price_range: '$$',
        latitude: 17.42000000,
        longitude: 78.45000000,
        owner_id: sk1Id
      },
      {
        name: 'Club X',
        category: 'Clubs',
        description: 'Hyderabad\'s premier nightlife destination with top DJs, dynamic visual mapping, and hand-crafted mocktails.',
        address: 'Hi-Tech City, Hyderabad',
        phone: '9999966666',
        price_range: '$$$',
        latitude: 17.45000000,
        longitude: 78.38000000,
        owner_id: sk2Id
      },
      {
        name: 'Modern Salon',
        category: 'Salons',
        description: 'Upscale hair salon specializing in modern cuts, color highlights, and hair therapeutic treatments.',
        address: 'Secunderabad, Hyderabad',
        phone: '9999977777',
        price_range: '$$',
        latitude: 17.44110000,
        longitude: 78.49880000,
        owner_id: sk1Id
      }
    ];

    const businessIds = {};

    for (const biz of sampleBusinesses) {
      const bizCheck = await db.query("SELECT * FROM businesses WHERE name = $1", [biz.name]);
      let bizId;
      if (bizCheck.rows.length === 0) {
        const inserted = await db.query(
          `INSERT INTO businesses (name, category, description, address, phone, price_range, latitude, longitude, owner_id) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
          [biz.name, biz.category, biz.description, biz.address, biz.phone, biz.price_range, biz.latitude, biz.longitude, biz.owner_id]
        );
        bizId = inserted.rows[0].id;
        console.log(`Created business: ${biz.name}`);
      } else {
        bizId = bizCheck.rows[0].id;
        // Make sure it has the owner_id set properly
        await db.query("UPDATE businesses SET owner_id = $1 WHERE id = $2", [biz.owner_id, bizId]);
        console.log(`Business ${biz.name} already exists. Updated owner.`);
      }
      businessIds[biz.name] = bizId;
    }

    // Let's also grab IDs of existing businesses (Taj Hotel, Pizza Hut, Siva Tiffins) to seed items for them
    const pizzaHutCheck = await db.query("SELECT id FROM businesses WHERE name = 'Pizza Hut'");
    if (pizzaHutCheck.rows.length > 0) {
      businessIds['Pizza Hut'] = pizzaHutCheck.rows[0].id;
      // Update owner to sk1Id for testing
      await db.query("UPDATE businesses SET owner_id = $1 WHERE id = $2", [sk1Id, pizzaHutCheck.rows[0].id]);
    }
    const tajHotelCheck = await db.query("SELECT id FROM businesses WHERE name = 'Taj Hotel'");
    if (tajHotelCheck.rows.length > 0) {
      businessIds['Taj Hotel'] = tajHotelCheck.rows[0].id;
      // Update owner to sk2Id for testing
      await db.query("UPDATE businesses SET owner_id = $1 WHERE id = $2", [sk2Id, tajHotelCheck.rows[0].id]);
    }
    const sivaTiffinsCheck = await db.query("SELECT id FROM businesses WHERE name = 'Siva Tiffins'");
    if (sivaTiffinsCheck.rows.length > 0) {
      businessIds['Siva Tiffins'] = sivaTiffinsCheck.rows[0].id;
      // Update owner to sk1Id for testing
      await db.query("UPDATE businesses SET owner_id = $1 WHERE id = $2", [sk1Id, sivaTiffinsCheck.rows[0].id]);
    }

    // 5. Seed Items for businesses
    console.log('Seeding items/products...');
    const itemsToSeed = [
      // Pizza Hut
      { bizName: 'Pizza Hut', name: 'Pizza Margherita', desc: 'Fresh tomato sauce, melted mozzarella, and fresh basil on our signature crust.', price: 12.00 },
      { bizName: 'Pizza Hut', name: 'Pepperoni Feast', desc: 'Double pepperoni and extra mozzarella cheese.', price: 15.00 },
      { bizName: 'Pizza Hut', name: 'Garlic Bread Stix', desc: 'Baked garlic breadsticks served with marinara dipping sauce.', price: 6.00 },
      
      // Taj Hotel
      { bizName: 'Taj Hotel', name: 'Executive Suite', desc: 'King size bed, city views, and access to the executive business club lounge.', price: 180.00 },
      { bizName: 'Taj Hotel', name: 'Premium Room', desc: 'Spacious room with a writing desk, free Wi-Fi, and premium mini bar.', price: 120.00 },
      { bizName: 'Taj Hotel', name: 'Grand Buffet', desc: 'International and local cuisines cooked by five-star chefs.', price: 35.00 },

      // Siva Tiffins
      { bizName: 'Siva Tiffins', name: 'Ghee Karam Dosa', desc: 'Crispy rice crepe spiced with red chutney powder and topped with pure ghee.', price: 2.50 },
      { bizName: 'Siva Tiffins', name: 'Idly (Plate)', desc: 'Three steamed rice cakes served with peanut chutney and piping hot sambar.', price: 1.50 },
      { bizName: 'Siva Tiffins', name: 'Medu Vada (Plate)', desc: 'Two crispy deep-fried lentil donuts served with coconut chutney.', price: 1.80 },

      // Iron Fitness
      { bizName: 'Iron Fitness', name: 'Monthly Gym Membership', desc: 'Unrestricted access to gym floor, cardio equipment, and locker rooms.', price: 30.00 },
      { bizName: 'Iron Fitness', name: 'Personal Training Session', desc: 'One-on-one 60-minute session with a certified personal fitness trainer.', price: 50.00 },
      { bizName: 'Iron Fitness', name: 'Whey Protein Shake', desc: 'Post-workout vanilla or chocolate protein shake with almond milk.', price: 4.50 },

      // Glow Beauty Parlour
      { bizName: 'Glow Beauty Parlour', name: 'Luxury Facial Treatment', desc: 'Deep cleansing, exfoliation, and custom serum massage for radiant skin.', price: 35.00 },
      { bizName: 'Glow Beauty Parlour', name: 'Haircut & Blow Dry', desc: 'Styling, hair wash, trim, and professional blow-dry finishing.', price: 25.00 },
      
      // Super Mart
      { bizName: 'Super Mart', name: 'Fresh Organic Apples (1kg)', desc: 'Crisp, sweet, and locally harvested red apples.', price: 3.50 },
      { bizName: 'Super Mart', name: 'Whole Wheat Bread Loaf', desc: 'Freshly baked local whole wheat sandwich bread.', price: 2.20 },

      // Organic Farmers Market
      { bizName: 'Organic Farmers Market', name: 'Pure Organic Honey (500g)', desc: 'Raw, unfiltered honey collected directly from local farms.', price: 9.99 },
      { bizName: 'Organic Farmers Market', name: 'Organic Avocados (1kg)', desc: 'Creamy Hass avocados perfect for salads and guacamole.', price: 6.50 },

      // Bliss Café
      { bizName: 'Bliss Café', name: 'Espresso Macchiato', desc: 'A double shot of espresso with a small dollop of foamed milk.', price: 3.80 },
      { bizName: 'Bliss Café', name: 'Chocolate Butter Croissant', desc: 'Flaky, buttery pastry filled with rich Belgian dark chocolate.', price: 3.50 },

      // Club X
      { bizName: 'Club X', name: 'VIP Lounge Table Booking', desc: 'Reserved seating for up to 5 people, including dedicated host service.', price: 120.00 },
      { bizName: 'Club X', name: 'Blue Lagoon Mocktail', desc: 'Refreshing blue curacao syrup mixed with lemonade and crushed ice.', price: 10.00 }
    ];

    for (const item of itemsToSeed) {
      const bizId = businessIds[item.bizName];
      if (!bizId) continue;
      
      // Check if item already exists
      const itemCheck = await db.query("SELECT * FROM items WHERE business_id = $1 AND name = $2", [bizId, item.name]);
      if (itemCheck.rows.length === 0) {
        await db.query(
          "INSERT INTO items (business_id, name, description, price) VALUES ($1, $2, $3, $4)",
          [bizId, item.name, item.desc, item.price]
        );
        console.log(`Added item: ${item.name} to ${item.bizName}`);
      }
    }

    // 6. Seed Reviews
    console.log('Seeding reviews...');
    const reviewsToSeed = [
      { bizName: 'Pizza Hut', userId: cust1Id, rating: 4, comment: 'Great pizza, fast and hot delivery!' },
      { bizName: 'Pizza Hut', userId: cust2Id, rating: 5, comment: 'Staff was super friendly and the pepperoni was perfect.' },
      
      { bizName: 'Taj Hotel', userId: cust1Id, rating: 5, comment: 'Best stay experience in Hyderabad! Luxurious rooms and five-star breakfast.' },
      { bizName: 'Taj Hotel', userId: cust2Id, rating: 4, comment: 'Very clean and spacious. The buffet was top-notch.' },

      { bizName: 'Siva Tiffins', userId: cust1Id, rating: 5, comment: 'Excellent ghee dosas! Very pocket-friendly and tasty.' },
      { bizName: 'Siva Tiffins', userId: cust2Id, rating: 5, comment: 'Delicious idly, and the sambar is out of this world!' },

      { bizName: 'Iron Fitness', userId: cust2Id, rating: 4, comment: 'Very clean gym, and they have excellent quality free-weights.' },
      
      { bizName: 'Glow Beauty Parlour', userId: cust1Id, rating: 5, comment: 'Loved my facial treatment. Very professional staff!' },
      
      { bizName: 'Bliss Café', userId: cust2Id, rating: 5, comment: 'Perfect macchiato! The croissants are always fresh.' }
    ];

    for (const rev of reviewsToSeed) {
      const bizId = businessIds[rev.bizName];
      if (!bizId) continue;

      // Check if review already exists from this user to this business (due to unique constraint if set, or just general check)
      const revCheck = await db.query("SELECT * FROM reviews WHERE user_id = $1 AND business_id = $2", [rev.userId, bizId]);
      if (revCheck.rows.length === 0) {
        await db.query(
          "INSERT INTO reviews (user_id, business_id, rating, comment) VALUES ($1, $2, $3, $4)",
          [rev.userId, bizId, rev.rating, rev.comment]
        );
        console.log(`Added review for: ${rev.bizName}`);
      }
    }

    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Seeding error:', error);
  } finally {
    // Terminate connection pool
    db.pool.end();
  }
}

seed();
