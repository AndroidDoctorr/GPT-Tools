export enum Role { system = 1, user, assistant, function }
export class ChatRequestBody
{
    messages: Array<ChatMessage>
    model: string
    max_tokens: number
    temperature: number

    constructor(messages: Array<ChatMessage>, model?: string, temperature?: number) {
        this.messages = messages
        if (model) this.model = model
        if (temperature != undefined) this.temperature = temperature
    }
}
export class ChatResponseBody
{
    id: string
    object: string
    created: number
    model: string
    choices: Array<ChatResponse>
    usage: Usage
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
    index: number
    message: ChatMessage
    finish_reason: string

    ToString()
    {
        return this.index + ". " + this.message;
    }
}
export class Usage {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number

    ToString()
    {
        return "P Tokens: " + this.prompt_tokens + ", C Tokens: " + this.completion_tokens + ", Total: " + this.total_tokens;
    }
}
export class DataSet {
    data: Array<IdealPrompt>
}
export class IdealPrompt {
    prompt: string
    completion: string
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