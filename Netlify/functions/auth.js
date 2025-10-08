const crypto = require('crypto');

// User accounts with hashed passwords
const users = {
  'admin': {
    password: 'SpeedyAdmin2024!',
    passwordHash: crypto.createHash('sha256').update('SpeedyAdmin2024!').digest('hex')
  },
  'manager': {
    password: 'IndexManager#123',
    passwordHash: crypto.createHash('sha256').update('IndexManager#123').digest('hex')
  },
  'staff': {
    password: 'PressRelease@456',
    passwordHash: crypto.createHash('sha256').update('PressRelease@456').digest('hex')
  }
};

// Generate a simple token (in production, use JWT)
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
      headers
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

    // Check if user exists
    const user = users[username.toLowerCase()];
    if (!user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid username or password' })
      };
    }

    // Verify password
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    if (passwordHash !== user.passwordHash) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid username or password' })
      };
    }

    // Generate token
    const token = generateToken(username);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        token,
        username,
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
