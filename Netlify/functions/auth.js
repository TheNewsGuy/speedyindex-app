exports.handler = async (event) => {
  // Log for debugging
  console.log('Auth function called');
  console.log('Method:', event.httpMethod);
  console.log('Body:', event.body);

  // Handle CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: ''
    };
  }

  // Simple hardcoded check
  try {
    const { username, password } = JSON.parse(event.body || '{}');
    
    // Direct password check
    const validLogins = {
      'admin': 'SpeedyAdmin2024!',
      'manager': 'IndexManager#123', 
      'staff': 'PressRelease@456'
    };

    if (validLogins[username] === password) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          token: 'simple-token-' + username,
          username: username
        })
      };
    }

    return {
      statusCode: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Invalid credentials',
        received: { username, passwordLength: password ? password.length : 0 }
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Server error',
        message: error.message
      })
    };
  }
};

// Simple token verification
exports.verifyToken = (token) => {
  if (token && token.startsWith('simple-token-')) {
    return token.replace('simple-token-', '');
  }
  return null;
};
