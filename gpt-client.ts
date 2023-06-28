import axios, { AxiosInstance } from 'axios';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
// Load API key from .env
dotenv.config();

class ChatGPTClient {
    private api: AxiosInstance;
    private token: string;

    constructor(token: string) {
        this.token = process.env.API_TOKEN as string;
        if (!this.token) {
            throw new Error('API_TOKEN environment variable is not set.');
        }

        this.api = axios.create({
            baseURL: 'https://api.openai.com/v1/chat/completions',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
    }

    async sendMessage(message: string): Promise<string> {
        try {
            const newMessage = new ChatMessage(message);

            const response = await this.api.post('', {
                messages: [newMessage],
                max_tokens: 100
            });

            return response.data.choices[0].text.trim();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    async CreatePTM(filePath: string) {
        const command = `npm run prepare-data -- --file "${filePath}"`;
        try {
            const output = execSync(command, { encoding: 'utf8' });
            console.log('Script execution completed.');
            console.log('Output:', output);
        } catch (error) {
            console.error('Script execution failed:', error);
        }
    }
}

export const chatGPTClient = new ChatGPTClient('YOUR_API_TOKEN');