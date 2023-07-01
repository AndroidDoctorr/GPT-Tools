import axios, { AxiosInstance } from 'axios'
import { ChatMessage, Agent, Role, ChatResponseBody } from './gpt-models'

export default class GPTClient {
    private api: AxiosInstance
    private token: string

    public defaultTemperature: number

    constructor() {
        // Load API key from .env
        this.token = process.env.REACT_APP_API_TOKEN as string
        this.defaultTemperature = 0.2
        if (!this.token) {
            throw new Error('API_TOKEN environment variable is not set.')
        }

        this.api = axios.create({
            baseURL: 'https://api.openai.com/v1/chat/completions',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            }
        })
    }
    async singlePrompt(message: string, model?: string, temperature?: number): Promise<string> {
        try {
            const newMessage = new ChatMessage(message)
            return await this.continueConversation([newMessage], model, temperature)
        } catch (error) {
            console.error('API request failed:', error)
            throw error
        }
    }
    async createPTM(childProcess: any, filePath: string) {
        const command = `npm run train-model -- --file "${filePath}"`
        try {
            const output = childProcess.execSync(command, { encoding: 'utf8' })
            console.log('Script execution completed.')
            console.log('Output:', output)

            // TODO: This should return a string with the name of the model
            //     OR an object with more info?
        } catch (error) {
            console.error('Script execution failed:', error)
        }
    }
    async replyToConversation(messages: Array<ChatMessage>, nextMessage: string): Promise<string> {
        const nextChatMessage = new ChatMessage(nextMessage)
        const conversation = [...messages, nextChatMessage];

        return this.continueConversation(conversation)
    }
    async createAgent(agent: Agent, model?: string, conversation?: Array<ChatMessage>, temperature?: number): Promise<string> {
        const systemMessage = new ChatMessage(agent.getSystemPrompt(), Role.system)

        const messages = conversation ? [systemMessage, ...conversation] : [systemMessage]
        return this.continueConversation(messages, model, temperature)
    }
    async continueConversation(messages: Array<ChatMessage>, model?: string, temperature?: number): Promise<string> {
        try {
            const response = await this.api.post('', {
                model: model || 'gpt-3.5-turbo',
                temperature: temperature == undefined ? this.defaultTemperature : temperature,
                messages,
                max_tokens: 100
            })

            let responseBody = new ChatResponseBody()
            Object.assign(responseBody, response.data)
            return responseBody.choices[0].message.content
        } catch (error) {
            console.error('Conversation failed:', error)
            throw error
        }
    }
}