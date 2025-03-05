import { useState, useCallback, useRef, useEffect } from 'react';
import DeepgramService from '../services/deepgramService';

/**
 * Custom hook for managing Deepgram transcription
 * 
 * @param {Object} options - Hook options
 * @param {string} options.apiKey - Deepgram API key
 * @param {Function} options.logger - Logger function for Deepgram events
 * @returns {Object} Deepgram control methods and state
 */
const useDeepgram = ({ apiKey, logger }) => {
  // Transcription state
  const [transcription, setTranscription] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  
  // Deepgram configuration
  const [interimResults, setInterimResults] = useState(true);
  const [smartFormat, setSmartFormat] = useState(true);
  const [punctuate, setPunctuate] = useState(true);
  
  // Service reference
  const deepgramServiceRef = useRef(null);
  
  /**
   * Initializes the Deepgram service
   */
  const initializeDeepgram = useCallback(() => {
    if (!apiKey) {
      logger?.log('ERROR: Deepgram API Key is undefined or empty');
      return false;
    }
    
    // Create event handlers
    const onTranscriptReceived = (transcript, isFinal, response) => {
      if (transcript && transcript.trim()) {
        logger?.log(`Transcript received (${isFinal ? 'final' : 'interim'}): ${transcript}`);
        
        if (isFinal) {
          // For final results, append to the transcription
          setTranscription(prev => {
            // Don't add duplicates
            if (prev.endsWith(transcript)) {
              logger?.log('Duplicate transcript detected, skipping');
              return prev;
            }
            
            // Add proper spacing
            const needsSpace = prev.length > 0 && 
                              ![' ', '.', '?', '!', ','].includes(prev[prev.length - 1]);
            const newTranscription = prev + (needsSpace ? ' ' : '') + transcript;
            logger?.log(`Updated transcription: ${newTranscription}`);
            return newTranscription;
          });
        } else if (interimResults) {
          logger?.log('Processing interim result');
          // For interim results, show them in the UI without permanently saving
          setTranscription(prev => {
            // Find the last sentence end
            const lastCompleteSentenceEnd = Math.max(
              prev.lastIndexOf('. '),
              prev.lastIndexOf('? '),
              prev.lastIndexOf('! ')
            );
            
            // If there's a complete sentence, keep it and add the interim result
            if (lastCompleteSentenceEnd >= 0) {
              const completePart = prev.substring(0, lastCompleteSentenceEnd + 2);
              const newTranscription = completePart + transcript;
              logger?.log(`Updated interim transcription: ${newTranscription}`);
              return newTranscription;
            }
            
            logger?.log(`Setting interim transcription: ${transcript}`);
            return transcript;
          });
        }
      }
    };
    
    const onSpeechStarted = () => {
      logger?.log('Speech detected by Deepgram');
    };
    
    const onSpeechFinished = () => {
      logger?.log('Speech finished');
    };
    
    const onError = (error) => {
      logger?.log(`Deepgram error: ${JSON.stringify(error)}`);
    };
    
    const onClose = (event) => {
      logger?.log(`Deepgram WebSocket closed: code=${event.code}, reason=${event.reason}`);
      setIsConnected(false);
    };
    
    // Create Deepgram service
    deepgramServiceRef.current = new DeepgramService({
      apiKey,
      onTranscriptReceived,
      onSpeechStarted,
      onSpeechFinished,
      onError,
      onClose,
      logger: {
        log: (message) => logger?.log(message)
      }
    });
    
    return true;
  }, [apiKey, interimResults, logger]);
  
  /**
   * Connects to the Deepgram API
   * 
   * @returns {Promise<boolean>} Whether connection was successful
   */
  const connectToDeepgram = useCallback(async () => {
    try {
      if (!deepgramServiceRef.current) {
        const initialized = initializeDeepgram();
        if (!initialized) {
          return false;
        }
      }
      
      logger?.log('Connecting to Deepgram...');
      
      const connected = await deepgramServiceRef.current.connect({
        interimResults,
        punctuate,
        smartFormat
      });
      
      setIsConnected(connected);
      return connected;
    } catch (error) {
      logger?.log(`Failed to connect to Deepgram: ${error.message}`);
      setIsConnected(false);
      return false;
    }
  }, [initializeDeepgram, interimResults, punctuate, smartFormat, logger]);
  
  /**
   * Disconnects from the Deepgram API
   */
  const disconnectFromDeepgram = useCallback(() => {
    try {
      if (deepgramServiceRef.current) {
        deepgramServiceRef.current.disconnect();
        setIsConnected(false);
        logger?.log('Disconnected from Deepgram');
      }
    } catch (error) {
      logger?.log(`Error disconnecting from Deepgram: ${error.message}`);
    }
  }, [logger]);
  
  /**
   * Sends audio data to Deepgram for processing
   * 
   * @param {Uint8Array} audioData - Audio data to send
   * @param {number} chunkNumber - Sequential number of this audio chunk
   * @returns {boolean} Whether sending was successful
   */
  const sendAudioToDeepgram = useCallback((audioData, chunkNumber) => {
    try {
      if (!deepgramServiceRef.current) {
        logger?.log('Deepgram service not initialized');
        return false;
      }
      
      if (!isConnected) {
        // If the state says we're not connected, but this is not the first chunk,
        // try to reconnect before giving up
        if (chunkNumber > 0) {
          logger?.log(`Connection to Deepgram lost. Attempting to reconnect before sending chunk #${chunkNumber}...`);
          
          // Try to reconnect - use a synchronous check first
          const socketState = deepgramServiceRef.current.getSocketState();
          if (socketState !== WebSocket.OPEN) {
            // Don't wait for reconnection here, just log the attempt
            connectToDeepgram().then(connected => {
              logger?.log(`Reconnection attempt ${connected ? 'successful' : 'failed'}`);
            });
            logger?.log('Not connected to Deepgram, queued reconnection attempt');
            return false;
          } else {
            // Socket is actually open but state is wrong - fix the state
            logger?.log('Fixing incorrect connection state - socket is actually open');
            setIsConnected(true);
          }
        } else {
          logger?.log('Not connected to Deepgram');
          return false;
        }
      }
      
      return deepgramServiceRef.current.sendAudio(audioData);
    } catch (error) {
      logger?.log(`Error sending audio to Deepgram: ${error.message}`);
      return false;
    }
  }, [isConnected, logger, connectToDeepgram]);
  
  /**
   * Clears the current transcription
   */
  const clearTranscription = useCallback(() => {
    setTranscription('');
  }, []);
  
  return {
    transcription,
    isConnected,
    interimResults,
    setInterimResults,
    smartFormat,
    setSmartFormat,
    punctuate,
    setPunctuate,
    connectToDeepgram,
    disconnectFromDeepgram,
    sendAudioToDeepgram,
    clearTranscription
  };
};

export default useDeepgram; 