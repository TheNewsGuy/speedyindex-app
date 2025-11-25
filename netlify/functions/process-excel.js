const axios = require('axios');

// RalfyIndex API configuration
const RALFYINDEX_API_KEY = process.env.RALFYINDEX_API_KEY || '302f64eeb8acbe60e90a48d9711aea9b485bc8fb24f476ea668b294c80d8581c';
const RALFYINDEX_API_URL = 'https://api.ralfyindex.com';

function verifyToken(token) {
  if (token && token.startsWith('simple-token-')) {
    return token.replace('simple-token-', '');
  }
  return null;
}

exports.handler = async (event) => {
  console.log('Process Excel function called');
  
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

  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'No auth token' })
    };
  }

  const token = authHeader.split(' ')[1];
  const username = verifyToken(token);
  
  if (!username) {
    return {
      statusCode: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Invalid token' })
    };
  }

  try {
    const { urls } = JSON.parse(event.body);
    
    if (!urls || urls.length === 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'No URLs provided' })
      };
    }

    console.log(`User ${username} processing ${urls.length} URLs`);

    // Check balance first
    let initialBalance = null;
    try {
      const balanceResponse = await axios.post(
        `${RALFYINDEX_API_URL}/balance`,
        { apikey: RALFYINDEX_API_KEY },
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      if (balanceResponse.data.status === 'ok' && balanceResponse.data.balance !== undefined) {
        initialBalance = balanceResponse.data.balance;
        console.log(`Initial balance: ${initialBalance}`);
      }
    } catch (error) {
      console.error('Failed to check balance:', error.message);
    }

    // Create a project with batch of URLs (max 50 per request)
    const results = [];
    const batchSize = 50;
    
    for (let i = 0; i < urls.length && i < batchSize; i++) {
      results.push({
        site: urls[i].site,
        url: urls[i].url,
        status: 'pending',
        message: 'Queued for indexing'
      });
    }

    // Prepare URLs array for RalfyIndex
    const urlArray = urls.slice(0, batchSize).map(u => u.url);
    
    try {
      // Create project with RalfyIndex
      const projectResponse = await axios.post(
        `${RALFYINDEX_API_URL}/project`,
        {
          apikey: RALFYINDEX_API_KEY,
          projectName: `Batch_${username}_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}`,
          urls: urlArray
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000 // 15 second timeout
        }
      );

      if (projectResponse.data.status === 'ok' && projectResponse.data.creditsUsed) {
        // Update all results as successful since RalfyIndex queues them
        results.forEach(result => {
          result.status = 'success';
          result.message = 'Submitted to indexing queue';
        });
        
        console.log(`Credits used: ${projectResponse.data.creditsUsed}`);
      } else {
        // Handle unexpected response
        results.forEach(result => {
          result.status = 'error';
          result.message = 'Unexpected response from indexing service';
        });
      }
    } catch (error) {
      console.error('Project creation error:', error.response?.data || error.message);
      
      let errorMessage = 'Failed to create indexing project';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.status === 402) {
        errorMessage = 'Insufficient credits';
      }
      
      results.forEach(result => {
        result.status = 'error';
        result.message = errorMessage;
      });
    }

    // Check final balance
    let finalBalance = initialBalance;
    try {
      const balanceResponse = await axios.post(
        `${RALFYINDEX_API_URL}/balance`,
        { apikey: RALFYINDEX_API_KEY },
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      if (balanceResponse.data.status === 'ok' && balanceResponse.data.balance !== undefined) {
        finalBalance = balanceResponse.data.balance;
      }
    } catch (error) {
      console.error('Failed to check final balance:', error.message);
    }

    const successful = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'error').length;
    const creditsUsed = initialBalance && finalBalance ? initialBalance - finalBalance : successful;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        total: urls.length,
        successful,
        failed,
        results,
        credits: finalBalance,
        creditsUsed,
        processedBy: username
      })
    };

  } catch (error) {
    console.error('Process error:', error);
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
