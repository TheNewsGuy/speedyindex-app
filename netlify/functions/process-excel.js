const axios = require('axios');

// SpeedyIndex API configuration
const SPEEDYINDEX_API_KEY = process.env.SPEEDYINDEX_API_KEY || 'b5a752e3fe2cc1aab4bbcc2457be532f';

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

    // Create task with SpeedyIndex v2
    const urlArray = urls.map(u => u.url);
    const taskName = `Batch_${username}_${Date.now()}`;

    try {
      console.log('Creating SpeedyIndex task...');
      
      // Create task
      const taskResponse = await axios.post(
        'https://api.speedyindex.com/v2/task/google/indexer/create',
        {
          title: taskName,
          urls: urlArray,
          pay_per_indexed: true
        },
        {
          headers: {
            'Authorization': SPEEDYINDEX_API_KEY,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      console.log('SpeedyIndex response:', taskResponse.data);

      if (taskResponse.data.code === 0) {
        // Task created successfully
        const taskId = taskResponse.data.task_id;
        
        // Mark all URLs as successfully submitted
        const results = urls.map(({ site, url }) => ({
          site,
          url,
          status: 'success',
          message: `Submitted successfully (Task ID: ${taskId.slice(-8)})`
        }));

        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: true,
            total: urls.length,
            successful: urls.length,
            failed: 0,
            results,
            taskId,
            message: 'All URLs submitted to SpeedyIndex for processing',
            processedBy: username
          })
        };
      } else {
        // Handle API errors
        let errorMessage = 'Failed to create indexing task';
        if (taskResponse.data.code === 1) {
          errorMessage = 'Insufficient SpeedyIndex credits';
        } else if (taskResponse.data.code === 2) {
          errorMessage = 'Invalid request - check URL format';
        }
        
        console.error('SpeedyIndex API error:', taskResponse.data);
        throw new Error(errorMessage);
      }

    } catch (error) {
      console.error('SpeedyIndex request failed:', error.response?.data || error.message);
      
      let errorMessage = 'Failed to submit to SpeedyIndex';
      if (error.response?.status === 401) {
        errorMessage = 'Invalid SpeedyIndex API key';
      } else if (error.response?.status === 402) {
        errorMessage = 'Insufficient SpeedyIndex credits';
      } else if (error.response?.data?.code === 1) {
        errorMessage = 'Insufficient SpeedyIndex balance';
      } else if (error.response?.data?.code === 2) {
        errorMessage = 'SpeedyIndex validation error';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'SpeedyIndex request timed out - try smaller batches';
      }

      // Return error results
      const results = urls.map(({ site, url }) => ({
        site,
        url,
        status: 'error',
        message: errorMessage
      }));

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          total: urls.length,
          successful: 0,
          failed: urls.length,
          results,
          error: errorMessage,
          processedBy: username
        })
      };
    }

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
