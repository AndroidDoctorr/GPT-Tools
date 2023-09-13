import axios, { AxiosInstance } from 'axios'

export class GPTClient {
    private api: AxiosInstance

    public defaultTemperature: number
    public defaultModel: string

    constructor(apiKey: string) {
        this.defaultTemperature = 0.2
        this.defaultModel = 'gpt-3.5-turbo'

        if (!apiKey) {
            throw new Error('OPENAI_API_KEY environment variable is not set - make sure to use the REACT_APP_ prefix if using React, or the VITE_ prefix if using Vite')
        }

        this.api = axios.create({
            baseURL: 'https://api.openai.com/v1/chat/completions',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
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
    async singlePromptFull(message: string, model?: string, temperature?: number): Promise<ChatResponseBody> {
        try {
            const newMessage = new ChatMessage(message)
            return await this.continueConversationFull([newMessage], model, temperature)
        } catch (error) {
            console.error('API request failed:', error)
            throw error
        }
    }
    createPTM(filePath: string) {
        const command = `npm run train-model -- --file "${filePath}"`
        return command
    }
    async replyToConversation(messages: Array<ChatMessage>, nextMessage: string): Promise<string> {
        const nextChatMessage = new ChatMessage(nextMessage)
        const conversation = [...messages, nextChatMessage];

        return this.continueConversation(conversation)
    }
    async replyToConversationFull(messages: Array<ChatMessage>, nextMessage: string): Promise<ChatResponseBody> {
        const nextChatMessage = new ChatMessage(nextMessage)
        const conversation = [...messages, nextChatMessage];

        return this.continueConversationFull(conversation)
    }
    async createAgent(agent: Agent, model?: string, conversation?: Array<ChatMessage>, temperature?: number): Promise<string> {
        const systemMessage = new ChatMessage(agent.getSystemPrompt(), Role.system)

        const messages = conversation ? [systemMessage, ...conversation] : [systemMessage]
        return this.continueConversation(messages, model, temperature)
    }
    async continueConversation(messages: Array<ChatMessage>, model?: string, temperature?: number): Promise<string> {
        try {
            let responseBody = await this.continueConversationFull(messages, model, temperature)
            return responseBody.choices[0].message.content
        } catch (error) {
            console.error('Conversation failed:', error)
            throw error
        }
    }
    async continueConversationFull(messages: Array<ChatMessage>, model?: string, temperature?: number): Promise<ChatResponseBody> {
        try {
            const response = await this.api.post('', {
                model: model || this.defaultModel,
                temperature: temperature == undefined ? this.defaultTemperature : temperature,
                messages,
                max_tokens: 100
            })

            let responseBody = new ChatResponseBody()
            Object.assign(responseBody, response.data)
            return responseBody
        } catch (error) {
            console.error('Conversation failed:', error)
            throw error
        }
    }
}

export enum Role {
    system = 'system',
    user = 'user',
    assistant = 'assistant',
    function = 'function',
}
export class ChatRequestBody {
    messages: Array<ChatMessage>
    model?: string
    max_tokens?: number
    temperature?: number

    constructor(messages: Array<ChatMessage>, model?: string, temperature?: number) {
        this.messages = messages
        if (model) this.model = model
        if (temperature != undefined) this.temperature = temperature
    }
}
export class ChatResponseBody {
    id?: string
    object?: string
    created?: number
    model?: string
    choices?: Array<ChatResponse>
    usage?: Usage
}
export class ChatMessage {
    role: Role
    content: string

    constructor(message: string, role?: Role) {
        this.role = role || Role.user
        this.content = message
    }
}
export class ChatResponse {
    index?: number
    message?: ChatMessage
    finish_reason?: string

    ToString() {
        return this.index + ". " + this.message;
    }
}
export class Usage {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number

    ToString() {
        return "P Tokens: " + this.prompt_tokens + ", C Tokens: " + this.completion_tokens + ", Total: " + this.total_tokens;
    }
}
export class DataSet {
    data: Array<IdealPrompt>

    constructor(data: Array<IdealPrompt>) {
        this.data = data
    }
}
export class IdealPrompt {
    prompt: string
    completion: string

    constructor(prompt: string, completion: string) {
        this.prompt = prompt
        this.completion = completion
    }
}
export class Agent {
    name?: string
    role?: string
    task?: string
    format?: string
    restrictions?: string
    getSystemPrompt() {
        return `${!!this.role && "As a " + this.role + ","}` +
            ` ${this.task}.` +
            ` ${!!this.name && "Your name is " + this.name + "."}` +
            ` Format your response as ${this.format}.` +
            ` ${this.restrictions}`
    }
}