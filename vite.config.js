import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'

// Create Lambda client using credentials from ~/.aws/credentials
const lambdaClient = new LambdaClient({
  region: process.env.AWS_REGION || 'eu-north-1'
});

const apiPlugin = {
  name: 'api-plugin',
  configureServer(server) {
    server.middlewares.use('/api/chat', async (req, res) => {
      if (req.method !== 'POST') return;
      
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body);
          
          const lambdaPayload = {
            input: {
              messages: payload.messages
            }
          };

          const command = new InvokeCommand({
            FunctionName: 'coffee_chatbot_docker_function2',
            InvocationType: 'RequestResponse',
            // Need to convert JSON to buffer correctly for @aws-sdk/client-lambda
            Payload: Buffer.from(JSON.stringify(lambdaPayload)),
          });

          const response = await lambdaClient.send(command);
          const responsePayload = Buffer.from(response.Payload).toString('utf-8');
          
          res.setHeader('Content-Type', 'application/json');
          res.end(responsePayload);
        } catch (err) {
          console.error('Lambda Error:', err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message || JSON.stringify(err) }));
        }
      });
    });
  }
}

export default defineConfig({
  plugins: [react(), apiPlugin],
})
