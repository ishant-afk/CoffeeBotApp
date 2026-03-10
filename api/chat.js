import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

// Netlify injects environment variables defined in the Netlify UI properly
const lambdaClient = new LambdaClient({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

export default async function handler(req, res) {
  // CORS configuration if needed
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      body = JSON.parse(body);
    }

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
    
    return res.status(200).json(JSON.parse(responsePayload));
    
  } catch (err) {
    console.error('Lambda Error:', err);
    return res.status(500).json({ error: err.message || JSON.stringify(err) });
  }
}
