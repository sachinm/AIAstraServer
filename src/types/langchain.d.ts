declare module '@langchain/core/messages' {
  export class HumanMessage {
    constructor(content: string);
    content: string;
  }
  export class SystemMessage {
    constructor(content: string);
    content: string;
  }
}
