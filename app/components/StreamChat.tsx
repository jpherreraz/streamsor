import { getIdToken, onAuthStateChanged } from 'firebase/auth';
import { onValue, ref } from 'firebase/database';
import { getFunctions, httpsCallable } from 'firebase/functions';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { auth, database } from '../firebase';

interface ChatMessage {
  id: string;
  text: string;
  username: string;
  timestamp: number;
  userId?: string;
}

interface StreamChatProps {
  streamId: string;
  username?: string;
}

export default function StreamChat({ streamId, username = 'Anonymous' }: StreamChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const functions = getFunctions();
  const [isAuthed, setIsAuthed] = useState(false);

  // First, wait for auth to be initialized and force token refresh
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('StreamChat: Auth state changed:', user?.uid);
      if (user) {
        try {
          // Force token refresh
          const token = await getIdToken(user, true);
          console.log('StreamChat: Token refreshed successfully');
          setAuthInitialized(true);
          setIsAuthed(true);
        } catch (err) {
          console.error('StreamChat: Token refresh failed:', err);
          setError('Authentication error. Please try signing in again.');
          setLoading(false);
          setIsAuthed(false);
        }
      } else {
        console.log('StreamChat: No user signed in');
        setError('Please sign in to access chat');
        setLoading(false);
        setIsAuthed(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Then set up chat connection once auth is ready
  useEffect(() => {
    if (!authInitialized) {
      console.log('StreamChat: Waiting for auth to initialize...');
      return;
    }

    if (!streamId) {
      console.error('StreamChat: No stream ID provided');
      setError('Invalid stream ID');
      setLoading(false);
      return;
    }

    if (!auth.currentUser) {
      console.error('StreamChat: No authenticated user');
      setError('Please sign in to access chat');
      setLoading(false);
      return;
    }

    console.log('StreamChat: Current auth state:', auth.currentUser?.uid);
    console.log('StreamChat: Connecting to chat for stream:', streamId);
    
    const chatRef = ref(database, `chats/${streamId}/messages`);
    console.log('StreamChat: Using database path:', chatRef.toString());
    
    try {
      const unsubscribe = onValue(chatRef, 
        (snapshot) => {
          console.log('StreamChat: Received chat data, exists:', snapshot.exists());
          try {
            const data = snapshot.val();
            console.log('StreamChat: Chat data:', data);
            if (data) {
              const messageList = Object.entries(data).map(([id, msg]: [string, any]) => ({
                id,
                ...msg,
              }));
              const sortedMessages = messageList.sort((a, b) => a.timestamp - b.timestamp);
              setMessages(sortedMessages);
              // Scroll to bottom after messages update
              setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
              }, 100);
            } else {
              setMessages([]);
            }
            setError(null);
            setLoading(false);
          } catch (err) {
            console.error('StreamChat: Error processing chat data:', err);
            setError('Failed to load chat messages');
            setLoading(false);
          }
        },
        (error) => {
          console.error('StreamChat: Database error:', error);
          if (error.code === 'PERMISSION_DENIED') {
            setError('Permission denied. Please try signing in again.');
          } else {
            setError('Failed to connect to chat. Please try again.');
          }
          setLoading(false);
        }
      );

      return () => {
        console.log('StreamChat: Disconnecting from chat');
        unsubscribe();
      };
    } catch (err) {
      console.error('StreamChat: Setup error:', err);
      setError('Failed to setup chat connection');
      setLoading(false);
    }
  }, [authInitialized, streamId]);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !streamId) return;

    try {
      const sendChatMessage = httpsCallable(functions, 'sendChatMessage');
      await sendChatMessage({
        streamId,
        text: newMessage.trim(),
        username
      });
      
      setNewMessage('');
      setError(null);
      // Scroll to bottom after sending
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message. Please try again.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Connecting to chat...</Text>
      </View>
    );
  }

  if (!isAuthed) {
    return (
      <View style={styles.container}>
        <View style={styles.authPromptContainer}>
          <Text style={styles.authPromptText}>Please sign in to join the chat</Text>
          <TouchableOpacity
            style={styles.authButton}
            onPress={() => {
              // Trigger auth flow - you'll need to implement this
              console.log('Auth button pressed');
            }}
          >
            <Text style={styles.authButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setLoading(true);
            setError(null);
          }}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.headerText}>Stream Chat</Text>
        <Text style={styles.connectedText}>Connected</Text>
      </View>
      
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 ? (
          <Text style={styles.emptyText}>No messages yet. Be the first to chat!</Text>
        ) : (
          messages.map((message) => (
            <View key={message.id} style={styles.messageContainer}>
              <View style={styles.messageHeader}>
                <Text style={styles.username}>{message.username}</Text>
                <Text style={styles.timestamp}>{formatTimestamp(message.timestamp)}</Text>
              </View>
              <Text style={styles.messageText}>{message.text}</Text>
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message..."
          placeholderTextColor="#666"
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!newMessage.trim()}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  connectedText: {
    color: '#4CAF50',
    fontSize: 12,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  messageContainer: {
    marginBottom: 16,
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  username: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  timestamp: {
    color: '#666',
    fontSize: 12,
  },
  messageText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
    backgroundColor: '#2a2a2a',
  },
  input: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: '#fff',
    marginRight: 8,
    maxHeight: 100,
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  sendButtonDisabled: {
    backgroundColor: '#333',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1a1a1a',
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  authPromptContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  authPromptText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  authButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  authButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
}); 