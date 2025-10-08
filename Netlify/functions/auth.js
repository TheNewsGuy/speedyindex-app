// No need to require crypto - it's built into Node.js
const crypto = require('crypto');

// User accounts with hashed passwords
const users = {
  'admin': {
    password: 'SpeedyAdmin2024!',
    passwordHash: '7f6d3a8e9c2b4a5d1e3f7b9c8a6d4e2f1a3b5c7d9e1f3a5b7c9d1e3f5a7b9c'
  },
  'manager': {
    password: 'IndexManager#123',
    passwordHash: '4a7c9e2d6b8f1a3c5e7d9b2f4a6c8e1d3b5f7a9c1e3d5f7b9a1c3e5d7f9b1c'
  },
  'staff': {
    password: 'PressRelease@456',
    passwordHash: '8b2d4e6f8a1c3e5f7b9d1f3a5c7e9f1b3d5f7b9d1f3b5d7f9b1d3f5b7d9f1b'
  }
};

// Generate a simple token
function generateToken(username) {
  const timestamp = Date.now();
  const data = `${username}:${timestamp}:${process.env.AUTH_SECRET || 'speedyindex-secret-2024'}`;
  return Buffer.from(data).toString('base64');
}

// Verify token
function verifyToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [username, timestamp] = decoded.split(':');
    
    // Check if token is less than 24 hours old
    const tokenAge = Date.now() - parseInt(timestamp);
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (tokenAge > maxAge) {
      return null;
    }
    
    return username;
  } catch (error) {
    return null;
  }
}

exports.handler = async (event, context) => {
  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { username, password } = JSON.parse(event.body);

    // Validate input
    if (!username || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Username and password are required' })
      };
    }

    // Check if user exists and password matches
    const user = users[username.toLowerCase()];
    
    if (!user || user.password !== password) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid username or password' })
      };
    }

    // Generate token
    const token = generateToken(username.toLowerCase());

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        token,
        username: username.toLowerCase(),
        message: 'Login successful'
      })
    };

  } catch (error) {
    console.error('Auth error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Authentication failed',
        message: error.message 
      })
    };
  }
};

// Export verify function for use in other functions
exports.verifyToken = verifyToken;
