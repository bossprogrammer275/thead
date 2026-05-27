const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

require('dotenv').config();
const POLL_INTERVAL = 35000; // 35 seconds
const TARGET_URL = 'https://mysite-gab1.onrender.com';

async function pollUrl() {
  try {
    const response = await fetch(TARGET_URL);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    // FIX: Read as text instead of JSON to handle HTML homepages safely
    const data = await response.text();
    console.log(`Poll successful! Received ${data.length} characters of HTML/Text.`);

  } catch (error) {
    console.error('Polling error:', error.message);
  } finally {
    setTimeout(pollUrl, POLL_INTERVAL);
  }
}


// Start the polling loop
pollUrl();

let serviceAccount = null;
try {
  serviceAccount = require('./serviceAccountKey.json');
} catch (e) {
  // If not found as a file, check for environment variable representation
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch (parseErr) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON environment variable.');
    }
  }
}

if (!serviceAccount) {
  console.warn('⚠️ WARNING: serviceAccountKey.json not found and FIREBASE_SERVICE_ACCOUNT_JSON env var is missing.');
  console.warn('⚠️ Firestore operations will fail until Firebase credentials are provided.');
} else {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = serviceAccount ? admin.firestore() : null;
const app = express();


const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [
    'https://toolfinders.web.app',
    'https://toolfinders.firebaseapp.com',
    'http://localhost:5500',
    'http://localhost:3000',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:5501'
  ];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

const toolsRef = db ? db.collection('tools') : null;
const usersRef = db ? db.collection('users') : null;

// Middleware to verify database initialization
const verifyDb = (req, res, next) => {
  if (!db || !toolsRef || !usersRef) {
    return res.status(503).json({
      error: 'Firebase Firestore database not initialized.',
      suggestion: 'Please verify serviceAccountKey.json exists in backend/ or FIREBASE_SERVICE_ACCOUNT_JSON env var is set.'
    });
  }
  next();
};

app.use('/api', verifyDb);

// Dynamic Authentication Endpoints (Simple Custom Auth without Hashing)
app.post('/api/auth/signup', async (req, res) => {
  try {
    let { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    username = username.trim().toLowerCase();

    // Strictly validate format like @ismailg (no capitals, no special chars except leading @, no spaces)
    const usernameRegex = /^@[a-z0-9]+$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({
        error: 'Username must start with @ followed by only lowercase letters and numbers (e.g., @ismailg).'
      });
    }

    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters.' });
    }

    // Check if username is already taken
    const userDoc = await usersRef.doc(username).get();
    if (userDoc.exists) {
      return res.status(400).json({ error: 'Username already taken.' });
    }

    // Save user with plain text password as explicitly requested
    await usersRef.doc(username).set({
      username,
      password: password,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(201).json({ success: true, username });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    let { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    username = username.trim().toLowerCase();

    const userDoc = await usersRef.doc(username).get();
    if (!userDoc.exists || userDoc.data().password !== password) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    res.json({ success: true, username });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tools', async (req, res) => {

  try {
    const { name, intro, rating, bestFor, weakness, verdict, link, tags } = req.body;

    if (!name || !link) {
      return res.status(400).json({ error: 'Name and link are required.' });
    }

    const toolData = {
      name: name.trim(),
      intro: (intro || '').trim(),
      rating: Math.min(5, Math.max(0, Number(rating) || 0)),
      bestFor: (bestFor || '').trim(),
      weakness: (weakness || '').trim(),
      verdict: (verdict || '').trim(),
      link: link.trim(),
      tags: Array.isArray(tags)
        ? tags.map(t => t.trim().toLowerCase()).filter(Boolean)
        : [],
      views: 0,
      userRatingsCount: 0,
      avgUserRating: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await toolsRef.add(toolData);
    res.status(201).json({ id: docRef.id, ...toolData });
  } catch (err) {
    console.error('POST /api/tools error:', err);
    res.status(500).json({ error: err.message });
  }
});


app.put('/api/tools/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    delete updates.views;
    delete updates.userRatingsCount;
    delete updates.avgUserRating;
    delete updates.createdAt;
    delete updates.id;

    if (updates.tags && typeof updates.tags === 'string') {
      updates.tags = updates.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    }
    if (updates.rating !== undefined) {
      updates.rating = Math.min(5, Math.max(0, Number(updates.rating) || 0));
    }
    if (updates.name) updates.name = updates.name.trim();
    if (updates.intro) updates.intro = updates.intro.trim();
    if (updates.bestFor) updates.bestFor = updates.bestFor.trim();
    if (updates.weakness) updates.weakness = updates.weakness.trim();
    if (updates.verdict) updates.verdict = updates.verdict.trim();
    if (updates.link) updates.link = updates.link.trim();

    await toolsRef.doc(id).update(updates);
    const updated = await toolsRef.doc(id).get();
    res.json({ id, ...updated.data() });
  } catch (err) {
    console.error(`PUT /api/tools/${req.params.id} error:`, err);
    res.status(500).json({ error: err.message });
  }
});


app.delete('/api/tools/:id', async (req, res) => {
  try {
    const docRef = toolsRef.doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Tool not found.' });
    }

    await docRef.delete();
    res.json({ message: 'Tool deleted successfully.' });
  } catch (err) {
    console.error(`DELETE /api/tools/${req.params.id} error:`, err);
    res.status(500).json({ error: err.message });
  }
});


app.get('/api/tools/search', async (req, res) => {
  try {
    const query = (req.query.q || '').toLowerCase().trim();

    if (!query) {
      return res.json([]);
    }

    const snapshot = await toolsRef.get();
    const results = [];

    snapshot.forEach(doc => {
      const d = doc.data();
      const nameMatch = (d.name || '').toLowerCase().includes(query);
      const introMatch = (d.intro || '').toLowerCase().includes(query);
      const tagMatch = Array.isArray(d.tags) &&
        d.tags.some(tag => tag.toLowerCase().includes(query));

      if (nameMatch || introMatch || tagMatch) {
        results.push({ id: doc.id, ...d });
      }
    });

    results.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    res.json(results);
  } catch (err) {
    console.error('GET /api/tools/search error:', err);
    res.status(500).json({ error: err.message });
  }
});


app.post('/api/tools/:id/click', async (req, res) => {
  try {
    const docRef = toolsRef.doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Tool not found.' });
    }

    await docRef.update({
      views: admin.firestore.FieldValue.increment(1)
    });

    res.json({ message: 'Click recorded.' });
  } catch (err) {
    console.error(`POST /api/tools/${req.params.id}/click error:`, err);
    res.status(500).json({ error: err.message });
  }
});


app.post('/api/tools/:id/rate', async (req, res) => {
  try {
    const { rating } = req.body;
    const numRating = Number(rating);

    if (!numRating || numRating < 1 || numRating > 5) {
      return res.status(400).json({ error: 'Rating must be a number between 1 and 5.' });
    }

    const docRef = toolsRef.doc(req.params.id);

    const result = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);

      if (!doc.exists) {
        throw new Error('Tool not found.');
      }

      const data = doc.data();
      const currentCount = data.userRatingsCount || 0;
      const currentAvg = data.avgUserRating || 0;
      const newCount = currentCount + 1;
      const newAvg = ((currentAvg * currentCount) + numRating) / newCount;
      const roundedAvg = Math.round(newAvg * 10) / 10;

      transaction.update(docRef, {
        userRatingsCount: newCount,
        avgUserRating: roundedAvg
      });

      return { avgUserRating: roundedAvg, userRatingsCount: newCount };
    });

    res.json(result);
  } catch (err) {
    console.error(`POST /api/tools/${req.params.id}/rate error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// GET Tool Reviews Endpoint
app.get('/api/tools/:id/reviews', async (req, res) => {
  try {
    const reviewsSnapshot = await toolsRef.doc(req.params.id).collection('reviews').orderBy('createdAt', 'desc').get();
    const reviews = [];
    reviewsSnapshot.forEach(doc => {
      reviews.push({ id: doc.id, ...doc.data() });
    });
    res.json(reviews);
  } catch (err) {
    console.error(`GET /api/tools/${req.params.id}/reviews error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// POST Tool Review & Rating Endpoint (Dynamic aggregate recalculation in transaction)
app.post('/api/tools/:id/reviews', async (req, res) => {
  try {
    const { username, rating, comment } = req.body;
    const numRating = Number(rating);

    if (!username) {
      return res.status(401).json({ error: 'You must be logged in to leave a review.' });
    }
    if (!numRating || numRating < 1 || numRating > 5) {
      return res.status(400).json({ error: 'Rating must be a number between 1 and 5.' });
    }
    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: 'Review comment cannot be empty.' });
    }

    const docRef = toolsRef.doc(req.params.id);
    const reviewRef = docRef.collection('reviews').doc();

    const result = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);

      if (!doc.exists) {
        throw new Error('Tool not found.');
      }

      const data = doc.data();
      const currentCount = data.userRatingsCount || 0;
      const currentAvg = data.avgUserRating || 0;
      const newCount = currentCount + 1;
      const newAvg = ((currentAvg * currentCount) + numRating) / newCount;
      const roundedAvg = Math.round(newAvg * 10) / 10;

      transaction.update(docRef, {
        userRatingsCount: newCount,
        avgUserRating: roundedAvg
      });

      transaction.set(reviewRef, {
        username: username.trim().toLowerCase(),
        rating: numRating,
        comment: comment.trim(),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { avgUserRating: roundedAvg, userRatingsCount: newCount };
    });

    res.status(201).json({ success: true, ...result });
  } catch (err) {
    console.error(`POST /api/tools/${req.params.id}/reviews error:`, err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/analytics', async (req, res) => {
  try {
    const snapshot = await toolsRef.orderBy('views', 'desc').get();
    const tools = [];

    snapshot.forEach(doc => {
      tools.push({ id: doc.id, ...doc.data() });
    });

    res.json(tools);
  } catch (err) {
    console.error('GET /api/admin/analytics error:', err);
    res.status(500).json({ error: err.message });
  }
});


// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// Routing fallbacks
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/admin.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`FIND Backend running on port ${PORT}`);
});
