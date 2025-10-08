const axios = require('axios');

const SPEEDYINDEX_API_KEY = process.env.SPEEDYINDEX_API_KEY || '8b5dfdcfa457dc60590adc604d1128b5';

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

    // First, check the balance using v2 API
    let balance = null;
    try {
      const balanceResponse = await axios.get('https://api.speedyindex.com/v2/account', {
        headers: {
          'Authorization': SPEEDYINDEX_API_KEY
        }
      });
      balance = balanceResponse.data.balance.indexer;
      console.log(`Current balance: ${balance}`);
    } catch (error) {
      console.error('Failed to check balance:', error.response?.data || error.message);
    }

    // Process URLs individually using the v2 single URL endpoint
    const results = [];
    const batchSize = 10; // Process 10 at a time to avoid timeout
    
    for (let i = 0; i < urls.length && i < 50; i++) { // Limit to 50 URLs per request
      const { site, url } = urls[i];
      
      try {
        // Submit single URL to SpeedyIndex v2
        const response = await axios.post(
          'https://api.speedyindex.com/v2/google/url',
          { url },
          {
            headers: {
              'Authorization': SPEEDYINDEX_API_KEY,
              'Content-Type': 'application/json'
            },
            timeout: 5000
          }
        );
        
        if (response.data.code === 0) {
          results.push({
            site,
            url,
            status: 'success',
            message: 'Indexed successfully'
          });
        } else {
          results.push({
            site,
            url,
            status: 'error',
            message: response.data.code === 1 ? 'Insufficient balance' : 'Server overloaded'
          });
        }
      } catch (error) {
        let errorMessage = 'Failed to index';
        
        if (error.response?.status === 401) {
          errorMessage = 'Invalid API key';
        } else if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error.response?.data) {
          errorMessage = JSON.stringify(error.response.data);
        }
        
        results.push({
          site,
          url,
          status: 'error',
          message: errorMessage
        });
      }

      // Small delay between requests
      if (i < urls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Check final balance
    let finalBalance = balance;
    try {
      const balanceResponse = await axios.get('https://api.speedyindex.com/v2/account', {
        headers: {
          'Authorization': SPEEDYINDEX_API_KEY
        }
      });
      finalBalance = balanceResponse.data.balance.indexer;
    } catch (error) {
      console.error('Failed to check final balance:', error.message);
    }

    const successful = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'error').length;

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
        creditsUsed: balance && finalBalance ? balance - finalBalance : successful,
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
