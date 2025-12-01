import {useCallback, useEffect, useRef, useState} from 'react';
import SockJS from 'sockjs-client';
import {Client, type IMessage} from '@stomp/stompjs';
import type {NoteDto} from './notesApi';

export interface WebSocketMessage {
  type: 'NOTE_CREATED' | 'NOTE_UPDATED' | 'NOTE_DELETED' | 'USER_EDITING' | 'USER_STOPPED_EDITING';
  note?: NoteDto;
  noteId?: number;
  userId?: number;
  username?: string;
}

export interface EditingUser {
  userId: number;
  username: string;
  noteId: number;
}

interface UseWebSocketProps {
  onNoteCreated?: (note: NoteDto) => void;
  onNoteUpdated?: (note: NoteDto) => void;
  onNoteDeleted?: (noteId: number) => void;
  onUserEditing?: (editingUser: EditingUser) => void;
  onUserStoppedEditing?: (editingUser: EditingUser) => void;
  currentUserId?: number | null;
  currentUserEmail?: string | null; // Add this
}

export const useWebSocket = ({
                               onNoteCreated,
                               onNoteUpdated,
                               onNoteDeleted,
                               onUserEditing,
                               onUserStoppedEditing,
                               currentUserId,
                               currentUserEmail, // Add this
                             }: UseWebSocketProps) => {
  const clientRef = useRef<Client | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const connectFnRef = useRef<(() => void) | null>(null);

  // Store callbacks in refs to avoid recreating connect function
  const callbacksRef = useRef({
    onNoteCreated,
    onNoteUpdated,
    onNoteDeleted,
    onUserEditing,
    onUserStoppedEditing,
  });

  // Update callbacks ref when they change
  useEffect(() => {
    callbacksRef.current = {
      onNoteCreated,
      onNoteUpdated,
      onNoteDeleted,
      onUserEditing,
      onUserStoppedEditing,
    };
  }, [onNoteCreated, onNoteUpdated, onNoteDeleted, onUserEditing, onUserStoppedEditing]);

  // Handle incoming WebSocket messages
  const handleMessage = useCallback((data: WebSocketMessage) => {
    console.log('Received WebSocket message:', data);

    const callbacks = callbacksRef.current;

    switch (data.type) {
      case 'NOTE_CREATED':
        if (data.note && callbacks.onNoteCreated) {
          callbacks.onNoteCreated(data.note);
        }
        break;
      case 'NOTE_UPDATED':
        if (data.note && callbacks.onNoteUpdated) {
          callbacks.onNoteUpdated(data.note);
        }
        break;
      case 'NOTE_DELETED':
        if (data.noteId && callbacks.onNoteDeleted) {
          callbacks.onNoteDeleted(data.noteId);
        }
        break;
      case 'USER_EDITING':
        if (data.noteId && data.userId && data.username && callbacks.onUserEditing) {
          // Don't show our own editing status
          if (data.userId !== currentUserId) {
            callbacks.onUserEditing({
              userId: data.userId,
              username: data.username,
              noteId: data.noteId,
            });
          }
        }
        break;
      case 'USER_STOPPED_EDITING':
        if (data.noteId && data.userId && data.username && callbacks.onUserStoppedEditing) {
          if (data.userId !== currentUserId) {
            callbacks.onUserStoppedEditing({
              userId: data.userId,
              username: data.username,
              noteId: data.noteId,
            });
          }
        }
        break;
    }
  }, [currentUserId]);

  // Connect to WebSocket - using ref to avoid circular dependency
  useEffect(() => {
    const connectFunction = () => {
      const token = localStorage.getItem('token');

      if (!token || !currentUserEmail) {
        console.error('No JWT token or user email found');
        return;
      }

      if (clientRef.current && clientRef.current.connected) {
        console.log('Already connected, skipping...');
        return;
      }

      console.log('Connecting to WebSocket with user email:', currentUserEmail);
      const socket = new SockJS('http://localhost:8080/ws');
      const client = new Client({
        webSocketFactory: () => socket as WebSocket,
        connectHeaders: {
          Authorization: `Bearer ${token}`,
        },
        debug: (str) => {
          console.log('STOMP: ' + str);
        },
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
      });

      client.onConnect = () => {
        console.log('WebSocket Connected');
        setConnected(true);

        // Subscribe to public notes channel
        client.subscribe('/topic/notes', (message: IMessage) => {
          console.log('Received message on /topic/notes');
          const data: WebSocketMessage = JSON.parse(message.body);
          handleMessage(data);
        });

        // Subscribe to public editing status
        client.subscribe('/topic/notes/editing', (message: IMessage) => {
          console.log('Received message on /topic/notes/editing');
          const data: WebSocketMessage = JSON.parse(message.body);
          handleMessage(data);
        });

        // Subscribe to private queue for this user using email
        console.log(`Subscribing to /user/queue/notes`);
        client.subscribe(`/user/queue/notes`, (message: IMessage) => {
          console.log('Received message on private queue /user/queue/notes');
          const data: WebSocketMessage = JSON.parse(message.body);
          handleMessage(data);
        });

        client.subscribe(`/user/queue/notes/editing`, (message: IMessage) => {
          console.log('Received message on private queue /user/queue/notes/editing');
          const data: WebSocketMessage = JSON.parse(message.body);
          handleMessage(data);
        });
      };

      client.onStompError = (frame) => {
        console.error('STOMP error:', frame);
        setConnected(false);
      };

      client.onWebSocketClose = () => {
        console.log('WebSocket Disconnected');
        setConnected(false);

        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect...');
          if (connectFnRef.current) {
            connectFnRef.current();
          }
        }, 3000);
      };

      client.activate();
      clientRef.current = client;
    };

    connectFnRef.current = connectFunction;

    if (currentUserId !== null && currentUserId !== undefined && currentUserEmail) {
      connectFunction();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (clientRef.current) {
        clientRef.current.deactivate();
        clientRef.current = null;
        setConnected(false);
      }
    };
  }, [currentUserId, currentUserEmail, handleMessage]);

  const sendEditingStatus = useCallback((noteId: number, isEditing: boolean) => {
    if (clientRef.current && clientRef.current.connected) {
      console.log(`Sending editing status: noteId=${noteId}, isEditing=${isEditing}`);
      clientRef.current.publish({
        destination: '/app/notes/editing',
        body: JSON.stringify({
          noteId,
          isEditing,
        }),
      });
    } else {
      console.warn('Cannot send editing status: WebSocket not connected');
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (clientRef.current) {
      clientRef.current.deactivate();
      clientRef.current = null;
      setConnected(false);
    }
  }, []);

  return {
    connected,
    sendEditingStatus,
    disconnect,
  };
};
