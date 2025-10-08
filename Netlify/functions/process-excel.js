const axios = require('axios');
const { verifyToken } = require('./auth');

// Built-in API key - stored server-side for security
const SPEEDYINDEX_API_KEY = process.env.SPEEDYINDEX_API_KEY || '8b5dfdcfa457dc60590adc604d1128b5';

// Rate limiting helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

  // Verify authentication
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Authentication required' })
    };
  }

  const token = authHeader.split(' ')[1];
  const username = verifyToken(token);
  
  if (!username) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Invalid or expired token' })
    };
  }

  try {
    // Parse request body
    const { urls } = JSON.parse(event.body);

    if (!urls) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing URLs' })
      };
    }
    
    // Use the built-in API key
    const apiKey = SPEEDYINDEX_API_KEY;

    console.log(`User ${username} processing ${urls.length} URLs`);

    // Check SpeedyIndex credits first
    let credits = null;
    try {
      const creditsResponse = await axios.get('https://api.speedyindex.com/v1/credits', {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      credits = creditsResponse.data.credits;
      console.log(`Current credits: ${credits}`);
    } catch (error) {
      console.error('Failed to check credits:', error.message);
    }

    // Process URLs in batches to avoid overwhelming the API
    const results = [];
    const batchSize = 10;
    
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      
      // Process batch in parallel
      const batchPromises = batch.map(async ({ site, url }) => {
        try {
          // Submit to SpeedyIndex
          const response = await axios.post(
            'https://api.speedyindex.com/v1/url',
            { url },
            {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
              },
              timeout: 10000 // 10 second timeout
            }
          );
          
          return {
            site,
            url,
            status: 'success',
            message: 'Indexed successfully'
          };
        } catch (error) {
          // Handle different error types
          let errorMessage = 'Failed to index';
          
          if (error.response) {
            // API returned an error
            if (error.response.status === 401) {
              errorMessage = 'Invalid API key';
            } else if (error.response.status === 429) {
              errorMessage = 'Rate limit exceeded';
            } else if (error.response.data && error.response.data.message) {
              errorMessage = error.response.data.message;
            }
          } else if (error.request) {
            errorMessage = 'Network error - no response from SpeedyIndex';
          }
          
          return {
            site,
            url,
            status: 'error',
            message: errorMessage
          };
        }
      });
      
      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Log progress
      console.log(`Processed ${Math.min((i + batchSize), urls.length)} of ${urls.length} URLs`);
      
      // Rate limiting: wait 1 second between batches
      if (i + batchSize < urls.length) {
        await delay(1000);
      }
    }

    // Calculate summary
    const successful = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'error').length;

    // Check credits again if we had them initially
    let finalCredits = credits;
    if (credits !== null) {
      try {
        const creditsResponse = await axios.get('https://api.speedyindex.com/v1/credits', {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        });
        finalCredits = creditsResponse.data.credits;
      } catch (error) {
        console.error('Failed to check final credits:', error.message);
      }
    }

    // Log activity
    console.log(`User ${username} completed: ${successful} successful, ${failed} failed`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        total: urls.length,
        successful,
        failed,
        results,
        credits: finalCredits,
        creditsUsed: credits !== null && finalCredits !== null ? credits - finalCredits : null,
        processedBy: username
      })
    };

  } catch (error) {
    console.error('Handler error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Server error',
        message: error.message 
      })
    };
  }
};
