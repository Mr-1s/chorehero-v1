import React, { createContext, useContext, useState, ReactNode } from 'react';

interface MessageContextType {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  conversations: Conversation[];
  setConversations: (conversations: Conversation[]) => void;
}

interface Conversation {
  id: string;
  participant: {
    id: string;
    name: string;
    avatar: string;
    role: 'customer' | 'cleaner';
  };
  lastMessage: string;
  lastTimestamp: string;
  unreadCount: number;
  bookingId: string;
}

const MessageContext = createContext<MessageContextType | undefined>(undefined);

interface MessageProviderProps {
  children: ReactNode;
}

export const MessageProvider: React.FC<MessageProviderProps> = ({ children }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  return (
    <MessageContext.Provider value={{ 
      unreadCount, 
      setUnreadCount, 
      conversations, 
      setConversations 
    }}>
      {children}
    </MessageContext.Provider>
  );
};

export const useMessages = () => {
  const context = useContext(MessageContext);
  if (context === undefined) {
    throw new Error('useMessages must be used within a MessageProvider');
  }
  return context;
};

export type { Conversation }; 