import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const lambdaClient = new LambdaClient({
  region: process.env.MY_AWS_REGION || 'eu-north-1',
  credentials: {
    accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY,
  }
});

export const handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      headers, 
      body: JSON.stringify({ error: 'Method Not Allowed' }) 
    };
  }

  try {
    let body = event.body;
    if (typeof body === 'string') {
      body = JSON.parse(body);
    }

    // Isolate messages logic for Python Lambda
    const lambdaPayload = {
      input: {
        messages: body.messages
      }
    };

    const command = new InvokeCommand({
      FunctionName: 'coffee_chatbot_docker_function2',
      InvocationType: 'RequestResponse',
      Payload: Buffer.from(JSON.stringify(lambdaPayload)),
    });

    const response = await lambdaClient.send(command);
    const responsePayload = Buffer.from(response.Payload).toString('utf-8');
    
    return {
      statusCode: 200,
      headers,
      body: responsePayload
    };
    
  } catch (err) {
    console.error('Lambda Error:', err);
    return { 
      statusCode: 500, 
      headers, 
      body: JSON.stringify({ error: err.message || JSON.stringify(err) }) 
    };
  }
};
