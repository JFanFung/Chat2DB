export enum MessageType {
  USER = 'user',
  AI = 'ai',
  SQL = 'sql',
  ERROR = 'error',
}

export interface IChatMessage {
  id: string;
  type: MessageType;
  content: string;
  sql?: string;
  timestamp: number;
  isLoading?: boolean;
  executeStatus?: 'pending' | 'executing' | 'success' | 'error';
  executeResult?: IExecuteResult;
}

export interface IExecuteResult {
  success: boolean;
  message?: string;
  data?: any[];
  headerList?: any[];
  updateCount?: number;
  duration?: number;
}

export interface IChatSession {
  id: string;
  title: string;
  messages: IChatMessage[];
  createdAt: number;
  updatedAt: number;
}
