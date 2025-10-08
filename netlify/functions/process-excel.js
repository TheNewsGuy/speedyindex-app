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
    const { urls, batchStart = 0, batchSize = 50 } = JSON.parse(event.body);
    
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

    // Process only a subset of URLs
    const urlBatch = urls.slice(batchStart, batchStart + batchSize);
    console.log(`Processing URLs ${batchStart} to ${batchStart + urlBatch.length} of ${urls.length}`);
    
    const results = [];
    
    // Process in smaller chunks of 5 to stay under timeout
    for (let i = 0; i < urlBatch.length; i += 5) {
      const chunk = urlBatch.slice(i, i + 5);
      
      const chunkPromises = chunk.map(async ({ site, url }) => {
        try {
          const response = await axios.post(
            'https://api.speedyindex.com/v1/url',
            { url },
            {
              headers: {
                'Authorization': `Bearer ${SPEEDYINDEX_API_KEY}`,
                'Content-Type': 'application/json'
              },
              timeout: 5000
            }
          );
          
          return {
            site,
            url,
            status: 'success',
            message: 'Indexed successfully'
          };
        } catch (error) {
          let errorMessage = 'Failed to index';
          if (error.response?.data?.message) {
            errorMessage = error.response.data.message;
          }
          
          return {
            site,
            url,
            status: 'error',
            message: errorMessage
          };
        }
      });
      
      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
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
        results,
        successful,
        failed,
        hasMore: batchStart + batchSize < urls.length,
        nextBatch: batchStart + batchSize,
        totalUrls: urls.length,
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
