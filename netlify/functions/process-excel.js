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

    // Create a task with SpeedyIndex v2
    const urlArray = urls.map(u => u.url);
    const taskName = `Batch_${username}_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}`;

    try {
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
          timeout: 15000
        }
      );

      if (taskResponse.data.code !== 0) {
        let errorMessage = 'Failed to create indexing task';
        if (taskResponse.data.code === 1) {
          errorMessage = 'Insufficient balance';
        } else if (taskResponse.data.code === 2) {
          errorMessage = 'Validation error';
        }
        
        throw new Error(errorMessage);
      }

      const taskId = taskResponse.data.task_id;
      console.log(`Created task: ${taskId}`);

      // Wait a moment for task to initialize
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check task status
      let taskCompleted = false;
      let attempts = 0;
      let taskResult = null;

      while (!taskCompleted && attempts < 30) { // Max 30 attempts (1 minute)
        try {
          const statusResponse = await axios.post(
            'https://api.speedyindex.com/v2/task/google/indexer/status',
            { task_id: taskId },
            {
              headers: {
                'Authorization': SPEEDYINDEX_API_KEY,
                'Content-Type': 'application/json'
              }
            }
          );

          if (statusResponse.data.code === 0 && statusResponse.data.result) {
            taskResult = statusResponse.data.result;
            taskCompleted = taskResult.is_completed;
          }

          if (!taskCompleted) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
            attempts++;
          }
        } catch (error) {
          console.error('Status check error:', error.message);
          break;
        }
      }

      // Prepare results
      const results = urls.map(({ site, url }) => ({
        site,
        url,
        status: 'success',
        message: taskCompleted 
          ? `Task completed - Check SpeedyIndex dashboard for details`
          : `Task created - Processing in background (Task ID: ${taskId.slice(-8)})`
      }));

      // If task completed, try to get more detailed results
      if (taskCompleted && taskResult) {
        try {
          const reportResponse = await axios.post(
            'https://api.speedyindex.com/v2/task/google/indexer/fullreport',
            { task_id: taskId },
            {
              headers: {
                'Authorization': SPEEDYINDEX_API_KEY,
                'Content-Type': 'application/json'
              }
            }
          );

          if (reportResponse.data.code === 0 && reportResponse.data.result) {
            const report = reportResponse.data.result;
            const indexedUrls = new Set(report.indexed_links?.map(link => link.url) || []);
            const unindexedUrls = new Set(report.unindexed_links?.map(link => link.url) || []);

            // Update results with actual status
            results.forEach(result => {
              if (indexedUrls.has(result.url)) {
                result.status = 'success';
                result.message = 'Indexed successfully';
              } else if (unindexedUrls.has(result.url)) {
                result.status = 'error';
                result.message = 'Failed to index';
              }
            });
          }
        } catch (error) {
          console.error('Report fetch error:', error.message);
        }
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
          taskId,
          taskCompleted,
          processedCount: taskResult?.processed_count || 0,
          indexedCount: taskResult?.indexed_count || 0,
          processedBy: username
        })
      };

    } catch (error) {
      console.error('SpeedyIndex error:', error.response?.data || error.message);
      
      let errorMessage = 'Failed to process URLs';
      if (error.response?.data?.code === 1) {
        errorMessage = 'Insufficient SpeedyIndex credits';
      } else if (error.response?.data?.code === 2) {
        errorMessage = 'Invalid request format';
      } else if (error.message) {
        errorMessage = error.message;
      }

      // Return error results for all URLs
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
