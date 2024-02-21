import axios, { AxiosInstance } from 'axios'

const betaHeaders = { 'OpenAI-Beta': 'assistants=v1' }

export class GPTClient {
    // The HTTP Client
    private api: AxiosInstance
    // The Chatroom conversation history - messages include the associated speaker
    private conversation: Array<ChatroomMessage>
    // The Chatroom participants - this keeps track of their names, setup prompts, and custom temperatures
    private participants: Array<ChatAgent>
    // The default temperature of the completion requests
    public defaultTemperature: number
    // The GPT model to use
    public defaultModel: string

    constructor(apiKey: string) {
        this.defaultTemperature = 0.2
        this.defaultModel = 'gpt-3.5-turbo'

        if (!apiKey) {
            throw new Error('OPENAI_API_KEY environment variable is not set - make sure to use the REACT_APP_ prefix if using React, or the VITE_ prefix if using Vite')
        }

        this.api = axios.create({
            baseURL: 'https://api.openai.com/v1/',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            }
        })
    }

    // Chat Methods

    // Add a message to the chat with the role of System
    addSystemMessage(message: string) {
        this.addMessage(message, Role.system, 'System')
    }
    // Add a message to the chat with the role of User
    addHostMessage(message: string) {
        this.addMessage(message, Role.user, 'Host')
    }
    // Add a message to the chat with the given role and new participant name
    addMessage(message: string, role: Role, name: string, setupPrompt?: string, introPrompt?: string, temperature?: number) {
        if (this.isParticipantInChat(name)) {
            throw new Error('Chat participant ' + name + ' is already in the participants list - use addMessageFor() instead')
        } else {
            this.addParticipant(name, setupPrompt, introPrompt, temperature)
        }
        const chatMessage = new ChatMessage(message, role)
        const speaker = new ChatAgent(name)
        const chatRoomMessage = new ChatroomMessage(chatMessage, speaker)
        this.conversation.push(chatRoomMessage)
    }
    // Add a message to the chat directed towards a particlar participant
    addMessageFor(message: string, participant: ChatAgent, role?: Role) {
        if (!this.isParticipantInChat(participant.name)) {
            this.addParticipantAgent(participant)
        }
        const chatMessage = new ChatMessage(message, role || Role.user)
        const chatRoomMessage = new ChatroomMessage(chatMessage, participant)
        this.conversation.push(chatRoomMessage)
    }
    // Prompt a particular participant for a response
    addSystemMessageFor(message: string, participant: ChatAgent) {
        const chatMessage = new ChatMessage(message, Role.system)
        const chatRoomMessage = new ChatroomMessage(chatMessage, participant)
        this.conversation.push(chatRoomMessage)
    }
    // Get the current chatroom conversation history
    getConversation(): Array<ChatroomMessage> {
        return this.conversation
    }
    // Get the chatroom history as an array of chat messages only
    // - Names may be included in the message content, since different participant messages are not differentiated otherwise
    getConversationMessages(includeNames?: boolean): Array<ChatMessage> {
        return this.conversation.map(m => {
            const messageContent = includeNames ?
                m.speaker.name + ': ' + m.message.content :
                m.message.content
            return new ChatMessage(messageContent, m.message.role)
        })
    }
    // Empty the chatroom conversation history
    clearChat() {
        this.conversation.length = 0
    }

    // Participant (Agent) Methods

    // Add a new participant to the chatroom
    // Participants must have a unique name and a setup prompt that defines the participant.
    addParticipant(name: string, setupPrompt: string, introPrompt?: string, temperature?: number) {
        if (this.isParticipantInChat(name)) {
            throw new Error('Chat participants must have unique names - there is already a participant named ' + name + ' in this Chatroom')
        }
        const participant = new ChatAgent(name)
        participant.setupPrompt = setupPrompt
        participant.introPrompt = introPrompt
        participant.temperature = temperature > 2 ? 2 : temperature < 0 ? 0 : temperature
        this.addParticipantAgent(participant)
    }
    // Add an existing chat agent to the chatroom
    addParticipantAgent(participant: ChatAgent) {
        if (this.isParticipantInChat(participant.name)) {
            throw new Error(participant.name + ' is already in this Chatroom')
        }
        this.participants.push(participant)
    }
    // Remove a participant from chat with the given name, if they are in the chat
    removeParticipant(name: string) {
        let index = -1
        this.participants.forEach((p, i) => {
            if (p.name == name) index = i
        })
        if (index >= 0) {
            this.participants.splice(index, 1)
        } else {
            throw new Error('There is no participant in the Chatroom with the name ' + name + ' - try using isParticipantInChat() first')
        }
    }
    // Remove a participant from the chat
    removeParticipantAgent(participant: ChatAgent) {
        this.removeParticipant(participant.name)
    }
    // Determine whether a participant with a particular name is currently in the chatroom
    isParticipantInChat(name: string): boolean {
        let index = -1
        this.participants.forEach((p, i) => {
            if (p.name == name) index = i
        })
        return index > -1
    }
    // Get a participant's setup prompt, as a chat message
    getSetupMessage(participant: ChatAgent): ChatMessage {
        return new ChatMessage(participant.setupPrompt, Role.system)
    }
    // Get a participant's setup prompt, as a system chatroom message
    getSetupChatroomMessage(participant: ChatAgent): ChatroomMessage {
        return new ChatroomMessage(this.getSetupMessage(participant), participant)
    }
    // Get a participant's intro prompt, if it exists, as a system chat message
    getIntroMessage(participant: ChatAgent): ChatMessage {
        if (!this.doesParticipantHaveIntro(participant)) {
            throw new Error('Cannot create an intro message - participant ' + participant.name + ' does not have an intro prompt')
        }
        return new ChatMessage(participant.introPrompt, Role.system)
    }
    // Determine if a participant has an intro message prompt
    doesParticipantHaveIntro(participant: ChatAgent): boolean {
        return !!participant.introPrompt
    }
    // Get a participant's intro prompt, if it exists, as a system chatroom message
    getIntroChatroomMessage(participant: ChatAgent): ChatroomMessage {
        return new ChatroomMessage(this.getIntroMessage(participant), participant)
    }
    // Get all current participants in the chat
    getParticipants(): Array<ChatAgent> {
        return this.participants
    }
    // Clear out the list of participants
    clearParticipants() {
        this.participants.length = 0
    }

    // Prompt Methods

    // Prompt a particular participant in the chat for a response
    promptParticipant(participant: ChatAgent) {
        const setupMessage = this.getSetupChatroomMessage(participant)
        const chat = [setupMessage, ...this.conversation]
        this.continueChat(chat, participant)
    }
    // Prompt a response from every participant
    promptAllParticipants() {
        this.participants.forEach(p => this.promptParticipant(p))
    }
    // Introduce a participant - add their intro message and prompt a response
    introduceParticipant(participant: ChatAgent) {
        const setupMessage = this.getSetupChatroomMessage(participant)
        const chat = [setupMessage, ...this.conversation]
        // Include introduction prompt, if participant has one
        if (!!participant.introPrompt && !participant.wasIntroduced) {
            const introMessage = this.getIntroChatroomMessage(participant)
            chat.push(introMessage)
        }
        participant.wasIntroduced = true

        this.continueChat(chat, participant)
    }

    // Basic Helper Methods

    // Take in a set of Chatroom messages and prompt a particular participant to continue the chat
    async continueChat(messages: Array<ChatroomMessage>, participant: ChatAgent): Promise<ChatroomMessage> {
        const chatMessages = messages.map(m => m.message)
        // Get the first response from the model
        const responseBody = await this.continueConversationFull(chatMessages, this.defaultModel, participant.temperature)
        const responseMessage = responseBody.choices[0].message
        // Add the response as a Chatroom message
        const newMessage = new ChatroomMessage(responseMessage, participant)
        this.conversation.push(newMessage)
        return newMessage
    }
    // Return the entire response body of a conversation completion request
    async continueConversationFull(messages: Array<ChatMessage>, model?: string, temperature?: number, maxTokens?: number): Promise<ChatResponseBody> {
        try {
            const response = await this.api.post('chat/completions', {
                model: model || this.defaultModel,
                temperature: isNaN(temperature) ? this.defaultTemperature : temperature,
                messages,
                max_tokens: isNaN(maxTokens) ? 1024 : maxTokens
            })

            let responseBody = new ChatResponseBody()
            Object.assign(responseBody, response.data)
            return responseBody
        } catch (error) {
            console.error('Conversation failed:', error)
            throw error
        }
    }
    // Return just the first response from a conversation completion request
    async continueConversation(messages: Array<ChatMessage>, model?: string, temperature?: number, maxTokens?: number): Promise<string> {
        try {
            let responseBody = await this.continueConversationFull(messages, model, temperature, maxTokens)
            return responseBody.choices[0].message.content
        } catch (error) {
            console.error('Conversation failed:', error)
            throw error
        }
    }
    // A simple one-time text prompt that returns a the first response content
    async singlePrompt(message: string, model?: string, temperature?: number, maxTokens?: number): Promise<string> {
        try {
            const newMessage = new ChatMessage(message)
            return await this.continueConversation([newMessage], model, temperature, maxTokens)
        } catch (error) {
            console.error('API request failed:', error)
            throw error
        }
    }
    // A one-time text prompt that returns the entire response body
    async singlePromptFull(message: string, model?: string, temperature?: number, maxTokens?: number): Promise<ChatResponseBody> {
        try {
            const newMessage = new ChatMessage(message)
            return await this.continueConversationFull([newMessage], model, temperature, maxTokens)
        } catch (error) {
            console.error('API request failed:', error)
            throw error
        }
    }

    // PTM (Pre-Trained Model) Helper Methods

    // Returns the command necessary to create a pre-trained model
    // given a local path to a file the contains the necessary training data
    createPTM(filePath: string): string {
        const command = `npm run train-model -- --file "${filePath}"`
        return command
    }

    // Single Chat Methods

    // Prompt the default model for a response to a conversation with a new message added
    async replyToConversation(messages: Array<ChatMessage>, nextMessage: string): Promise<string> {
        const nextChatMessage = new ChatMessage(nextMessage)
        const conversation = [...messages, nextChatMessage];

        return this.continueConversation(conversation)
    }
    // Prompt the default model for a response to a conversation given a next user message
    async replyToConversationFull(messages: Array<ChatMessage>, nextMessage: string): Promise<ChatResponseBody> {
        const nextChatMessage = new ChatMessage(nextMessage)
        const conversation = [...messages, nextChatMessage];

        return this.continueConversationFull(conversation)
    }
    // Prompt single chat agent for a response given a conversation
    async createAgent(agent: Agent, model?: string, conversation?: Array<ChatMessage>, temperature?: number): Promise<string> {
        const systemMessage = new ChatMessage(agent.getSystemPrompt(), Role.system)

        const messages = conversation ? [systemMessage, ...conversation] : [systemMessage]
        return this.continueConversation(messages, model, temperature)
    }

    // Assistant Methods

    // Create Assistant
    async createAssistant(assistant: AssistantCreate): Promise<Assistant> {
        try {
            const response = await this.api.post('assistants', assistant)
            let responseBody = new Assistant()
            Object.assign(responseBody, response.data)
            return responseBody
        } catch (error) {
            console.error('Failed to create Assistant:', error)
            throw error
        }
    }
    // Create Assistant File
    async createAssistantFile(assistantFile: AssistantFileCreate): Promise<AssistantFile> {
        try {
            const response = await this.api.post(`assistants/${assistantFile.assistant_id}/files`, assistantFile)
            let responseBody = new AssistantFile()
            Object.assign(responseBody, response.data)
            return responseBody
        } catch (error) {
            console.error('Failed to create Assistant file:', error)
            throw error
        }
    }
    // Get Assistants
    async getAssistants(assistantsRequestPrams: AssistantsRequest): Promise<Assistant[]> {
        try {
            const response = await this.api.get('assistants', { params: assistantsRequestPrams, headers: betaHeaders })
            let responseBody = new AssistantsResult()
            Object.assign(responseBody, response.data)
            return responseBody.data
        } catch (error) {
            console.error('Failed to retrieve Assistants:', error)
            throw error
        }
    }
    // Get Assistant
    async getAssistant(id: string): Promise<Assistant> {
        try {
            const response = await this.api.get(`assistants/${id}`, { headers: betaHeaders })
            let responseBody = new Assistant()
            Object.assign(responseBody, response.data)
            return responseBody
        } catch (error) {
            console.error('Failed to retrieve Assistant:', error)
            throw error
        }
    }
    // Update Assistant
    async updateAssistant(assistant: AssistantCreate): Promise<Assistant> {
        try {
            const response = await this.api.post('assistants', assistant, { headers: betaHeaders })
            let responseBody = new Assistant()
            Object.assign(responseBody, response.data)
            return responseBody
        } catch (error) {
            console.error('Failed to update Assistant:', error)
            throw error
        }
    }
    // Delete Assistant
    async deleteAssistant(id: string): Promise<Deleted> {
        try {
            const response = await this.api.delete(`assistants/${id}`, { headers: betaHeaders })
            let responseBody = new Deleted()
            Object.assign(responseBody, response.data)
            return responseBody
        } catch (error) {
            console.error('Failed to delete Assistant:', error)
            throw error
        }
    }
    // Remove Assistant File
    async removeAssistantFile(assistant_id: string, file_id: string): Promise<Deleted> {
        try {
            const response = await this.api.delete(`assistants/${assistant_id}/files/${file_id}`, { headers: betaHeaders })
            let responseBody = new Deleted()
            Object.assign(responseBody, response.data)
            return responseBody
        } catch (error) {
            console.error('Failed to remove Assistant file:', error)
            throw error
        }
    }

    // File Methods

    // Create File
    async createFile(body: FileCreate): Promise<FileResponse> {
        try {
            const response = await this.api.post(`files`, body)
            let responseBody = new FileResponse()
            Object.assign(responseBody, response.data)
            return responseBody
        } catch (error) {
            console.error('Failed to create File:', error)
            throw error
        }
    }
    // Get File
    async getFile(id: string): Promise<FileResponse> {
        try {
            const response = await this.api.get(`files/${id}`)
            let responseBody = new FileResponse()
            Object.assign(responseBody, response.data)
            return responseBody
        } catch (error) {
            console.error('Failed to retrieve File:', error)
            throw error
        }
    }
    // Delete File
    async deleteFile(id: string): Promise<Deleted> {
        try {
            const response = await this.api.delete(`files/${id}`)
            let responseBody = new Deleted()
            Object.assign(responseBody, response.data)
            return responseBody
        } catch (error) {
            console.error('Failed to delete File:', error)
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

/* * * * * * * * * * * * * * * * * * * * * * * *
*                                               *
*   ChatGPT Request Models                      *
*                                               *
* * * * * * * * * * * * * * * * * * * * * * * * */
// ChatRequestBody - The body of the request required by the OpenAI API documentation
export class ChatRequestBody {
    // The conversation to which the model is supposed to reply
    messages: Array<ChatMessage>
    // The specific GPT model being targeted
    model?: string
    // The maximum number of tokens allowed for this completion
    max_tokens?: number
    // Temperature or randomness of the response (0.0 - 2.0)
    temperature?: number

    constructor(messages: Array<ChatMessage>, model?: string, temperature?: number) {
        this.messages = messages
        if (model) this.model = model
        if (temperature != undefined) this.temperature = temperature
    }
}
// ChatResponseBody - The body of the response as given in the OpenAI API documentation
export class ChatResponseBody {
    // The ID of this particular response (set)
    id?: string
    // Generally, "chat.completion" - the type of completion object
    // This can be different for function requests
    object?: string
    // The date and time the response was generated
    created?: number
    // The GPT model used
    model?: string
    // The responses generated
    // (the same request can be submitted multiple times to generate multiple responses)
    choices?: Array<ChatResponse>
    // The number of tokens used in the prompt and the response
    usage?: Usage
}
// ChatMessage - the basic chat message model used in requests and responses
export class ChatMessage {
    // The origin of this message
    role: Role
    // The text content of a prompt or a response
    content: string

    constructor(message: string, role?: Role) {
        this.role = role || Role.user
        this.content = message
    }
}
// ChatResponse - A specific conversation completion, an item in the Choices array that
//     is part of the completion Response Body object
export class ChatResponse {
    // The index of this particular response
    index?: number
    // The actual response message
    message?: ChatMessage
    // The reason this response was completed - finished, error, or token limit reached, etc.
    finish_reason?: string

    ToString() {
        return this.index + ". " + this.message;
    }
}
// Usage - A record of the number of tokens used in a completion request
export class Usage {
    // The number of tokens in the prompt
    prompt_tokens?: number
    // The number of tokens in the response
    completion_tokens?: number
    // The sum of these two numbers
    total_tokens?: number

    ToString() {
        return "P Tokens: " + this.prompt_tokens + ", C Tokens: " + this.completion_tokens + ", Total: " + this.total_tokens;
    }
}

/* * * * * * * * * * * * * * * * * * * * * * * *
*                                               *
*   Dataset preparation/PTM generation models   *
*                                               *
* * * * * * * * * * * * * * * * * * * * * * * * */
// Dataset - Used to train a model to create a PTM
export class DataSet {
    // A set of ideal prompt/response pairs
    data: Array<IdealPrompt>

    constructor(data: Array<IdealPrompt>) {
        this.data = data
    }
}
// IdealPrompt - A single training datum - a prompt and response
export class IdealPrompt {
    // A prompt intended for the PTM
    prompt: string
    // An ideal response from the PTM this data is intended to train
    completion: string

    constructor(prompt: string, completion: string) {
        this.prompt = prompt
        this.completion = completion
    }
}

/* * * * * * * * * * * * * * * * * * * * * * * *
*                                               *
*   Custom chat models                          *
*                                               *
* * * * * * * * * * * * * * * * * * * * * * * * */
// ChatAgent - A primed agent meant to take part in a conversation
export class ChatAgent {
    // The name of the participant - this must me unique and serves as their ID
    name: string
    // The system prompt given to a chat agent that creates and identifies the agent
    //     - Added to the beginning of the conversation when prompted for a response
    //     - Always appears first, and only for this particular agent
    setupPrompt: string
    // The system prompt given to a chat agent only once, when introduced.
    //    This message is added to the conversation
    introPrompt?: string
    // The randomness of this agent (0.0 - 2.0)
    temperature?: number
    // Whether or not the participant has been introduced - the intro prompt should only be used once
    wasIntroduced: boolean = false

    getSetupPrompt() {
        return this.setupPrompt + ' Respond only as this agent.'
    }

    constructor(name: string) {
        this.name = name
    }
}
// ChatroomMessage - A message that's part of a chat between one or more agents and a user/host
export class ChatroomMessage {
    // The message itself
    message: ChatMessage
    // The agent from whom this message originates (can be System or Host as well as a participant)
    speaker: ChatAgent

    constructor(message: ChatMessage, speaker: ChatAgent) {
        this.message = message
        this.speaker = speaker
    }
}
// Agent - intended to be a single-use agent, not part of a multi-agent chat.
//    Can be extended, and the getSystemPrompt method can be overridden
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
/* * * * * * * * * * * * * * * * * * * * * * * *
*                                               *
*   Assistant Models                            *
*                                               *
* * * * * * * * * * * * * * * * * * * * * * * * */
// Assistant - Represents an individual assistant configuration
export class Assistant {
    // Unique identifier for the assistant
    id: string
    // Type of the object, usually 'assistant'
    object: string
    // Timestamp when the assistant was created
    created_at: number
    // Optional name for the assistant
    name?: string
    // Optional description of the assistant's purpose or functionality
    description?: string
    // The GPT model used by the assistant
    model: string
    // Optional instructions for how the assistant should behave or be used
    instructions?: string
    // Optional array of tools the assistant can use
    tools?: string[]
    // Optional array of file identifiers associated with the assistant
    file_ids?: string[]
    // Optional metadata providing additional information about the assistant
    metadata?: object
}
// ToolType - Enum representing the types of tools an assistant can utilize
export enum ToolType {
    // Tool for interpreting and executing code
    code_interpreter,
    // Tool for retrieving information or data
    retrieval,
    // General-purpose tool for various functions
    function,
}
// AssistantTool - Represents a tool that can be attached to an assistant
export class AssistantTool {
    // Type of the tool from the ToolType enum
    type: ToolType
    // Optional object defining the specific function of the tool
    function?: object
}
// AssistantsResult - Represents a collection of assistants
export class AssistantsResult {
    object: string  // Type of the object, usually 'list' indicating a list of assistants
    data: Assistant[]  // Array of Assistant objects
    first_id: string  // Identifier of the first assistant in the list
    last_id: string  // Identifier of the last assistant in the list
    has_more: boolean  // Boolean indicating if there are more assistants beyond this list
}
// AssistantCreate - Represents the data structure for creating a new assistant
export class AssistantCreate {
    // The GPT model to be used by the new assistant
    model: string
    // Optional name for the new assistant
    name?: string
    // Optional description for the new assistant
    description?: string
    // Optional instructions for the new assistant
    instructions?: string
    // Optional array of tools to be used by the new assistant
    tools?: string[]
    // Optional array of file identifiers to be associated with the new assistant
    file_ids?: string[]
    // Optional metadata for the new assistant
    metadata?: object
}
// AssistantFile - Represents metadata for files attached to an Assistant.
export class AssistantFile {
    // Unique identifier for the file.
    id: string
    // Type of the object, usually 'file'.
    object: string
    // Timestamp when the file was created.
    created_at: number
    // Identifier of the assistant to which this file is attached.
    assistant_id: string
}
// AssistantFileCreate - Represents the structure to create a new file attachment for an Assistant.
export class AssistantFileCreate {
    // Identifier of the assistant to which a file will be attached.
    assistant_id: string
    // The identifier of the file to attach to the assistant.
    file_id: string
}
// AssistantsRequest - Represents the criteria for querying a list of Assistants.
export class AssistantsRequest {
    // Optional limit on the number of Assistants to return.
    limit?: number
    // Optional order in which to return the Assistants ('asc' or 'desc').
    order?: string
    // Optional identifier to specify the starting point for the query (for pagination).
    after?: string
    // Optional identifier to specify the ending point for the query (for pagination).
    before?: string
}
// AssistantDelete - Represents the status of an Assistant after a delete operation.
export class AssistantDelete {
    // The identifier of the deleted assistant.
    id: string
    // Type of the object, usually 'assistant'.
    object: string
    // Boolean indicating whether the assistant was successfully deleted.
    deleted: boolean
}
/* * * * * * * * * * * * * * * * * * * * * * * *
*                                               *
*   File Models                                 *
*                                               *
* * * * * * * * * * * * * * * * * * * * * * * * */
// FileCreate - Represents the structure for creating a new file in the system.
export class FileCreate {
    // The file object to be created.
    file: File
    // The purpose or intended use of the file.
    purpose: string
}
// FileResponse - Represents the response data for a file-related query or operation.
export class FileResponse {
    // Unique identifier for the file.
    id: string
    // Type of the object, usually 'file'.
    object: string
    // Size of the file in bytes.
    bytes: number
    // Timestamp when the file was created.
    created_at: number
    // Name of the file.
    filename: string
    // The purpose or intended use of the file.
    purpose: string
}
// Deleted - Represents the status of an object (such as a file or an assistant) after a delete operation.
export class Deleted {
    // The identifier of the deleted object.
    id: string
    // Type of the object, indicating what kind of object was deleted.
    object: string
    // Boolean indicating whether the object was successfully deleted.
    deleted: boolean
}
