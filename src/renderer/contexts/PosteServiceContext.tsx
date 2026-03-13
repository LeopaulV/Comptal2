import React, { createContext, useContext } from 'react';
import { PosteService } from '../services/PosteService';

export type PosteServiceType = typeof PosteService;

const PosteServiceContext = createContext<PosteServiceType | null>(null);

export const PosteServiceProvider: React.FC<{
  children: React.ReactNode;
  service: PosteServiceType;
}> = ({ children, service }) => (
  <PosteServiceContext.Provider value={service}>
    {children}
  </PosteServiceContext.Provider>
);

export function usePosteService(): PosteServiceType {
  const ctx = useContext(PosteServiceContext);
  return ctx ?? PosteService;
}
