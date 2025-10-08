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
       
       const results = [];
       const batchSize = 10;
       
       for (let i = 0; i < urls.length; i += batchSize) {
         const batch = urls.slice(i, i + batchSize);
         
         const batchPromises = batch.map(async ({ site, url }) => {
           try {
             const response = await axios.post(
               'https://api.speedyindex.com/v1/url',
               { url },
               {
                 headers: {
                   'Authorization': `Bearer ${SPEEDYINDEX_API_KEY}`,
                   'Content-Type': 'application/json'
                 },
                 timeout: 10000
               }
             );
             
             return {
               site,
               url,
               status: 'success',
               message: 'Indexed successfully'
             };
           } catch (error) {
             return {
               site,
               url,
               status: 'error',
               message: error.response?.data?.message || 'Failed to index'
             };
           }
         });
         
         const batchResults = await Promise.all(batchPromises);
         results.push(...batchResults);
         
         if (i + batchSize < urls.length) {
           await new Promise(resolve => setTimeout(resolve, 1000));
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
           credits: 0,
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
