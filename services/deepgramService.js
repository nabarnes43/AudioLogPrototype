/**
 * Service for interacting with the Deepgram API
 */
class DeepgramService {
  /**
   * Creates a new DeepgramService
   * 
   * @param {Object} config - Configuration options
   * @param {string} config.apiKey - Deepgram API key
   * @param {Function} config.onTranscriptReceived - Callback when transcript is received
   * @param {Function} config.onSpeechStarted - Callback when speech starts
   * @param {Function} config.onSpeechFinished - Callback when speech ends
   * @param {Function} config.onError - Callback when error occurs
   * @param {Function} config.onClose - Callback when connection closes
   * @param {Function} config.logger - Logger instance for logging events
   */
  constructor({
    apiKey,
    onTranscriptReceived,
    onSpeechStarted,
    onSpeechFinished,
    onError,
    onClose,
    logger
  }) {
    this.apiKey = apiKey;
    this.socket = null;
    this.onTranscriptReceived = onTranscriptReceived || (() => {});
    this.onSpeechStarted = onSpeechStarted || (() => {});
    this.onSpeechFinished = onSpeechFinished || (() => {});
    this.onError = onError || (() => {});
    this.onClose = onClose || (() => {});
    this.logger = logger || console;
  }

  /**
   * Creates a WebSocket connection to Deepgram
   * 
   * @param {Object} options - Connection options
   * @param {boolean} options.interimResults - Whether to return interim results
   * @param {boolean} options.punctuate - Whether to add punctuation
   * @param {boolean} options.smartFormat - Whether to use smart formatting
   * @returns {Promise<boolean>} Whether connection was successful
   */
  connect({ interimResults = false, punctuate = true, smartFormat = true }) {
    try {
      // If there's an existing connection, close it properly first
      if (this.socket) {
        try {
          this.disconnect();
        } catch (e) {
          this.logger.log(`Error disconnecting existing socket: ${e.message}`);
        }
      }
      
      // Validate API key before attempting to connect
      if (!this.apiKey) {
        this.logger.log('ERROR: Deepgram API Key is undefined or empty');
        return Promise.resolve(false);
      }
      
      // Build the WebSocket URL with all required parameters
      const wsUrl = new URL('wss://api.deepgram.com/v1/listen');
      
      // Use a more reliable encoding to ensure compatibility
      wsUrl.searchParams.append('encoding', 'linear16');
      wsUrl.searchParams.append('sample_rate', '16000');
      wsUrl.searchParams.append('channels', '1');
      
      // Add optional parameters based on user settings
      wsUrl.searchParams.append('interim_results', 'false');
      wsUrl.searchParams.append('punctuate', punctuate ? 'true' : 'false');
      wsUrl.searchParams.append('smart_format', smartFormat ? 'true' : 'false');
      
      // Try enhanced-model for better accuracy
      wsUrl.searchParams.append('model', 'general');
      wsUrl.searchParams.append('language', 'en-US');
      wsUrl.searchParams.append('endpointing', '800');
      wsUrl.searchParams.append('vad_events', 'true');
      wsUrl.searchParams.append('continuous', 'true');
      
      this.logger.log(`Connecting to Deepgram: ${wsUrl.toString()}`);
      
      // Initialize socket
      this.socket = new WebSocket(wsUrl.toString(), [
        'token', this.apiKey
      ]);

      // Set socket timeout for better connection handling
      if (this.socket.setSocketTimeout) {
        this.socket.setSocketTimeout(30000); // 30 second timeout
      }

      let isConnected = false;
      let connectionStartTime = Date.now();
      
      // Set up socket event handlers
      this.socket.onopen = () => {
        this.logger.log(`Deepgram WebSocket connection established in ${Date.now() - connectionStartTime}ms`);
        isConnected = true;
        
        // Send initial keepalive ping to ensure connection is active
        this.socket.send(JSON.stringify({ type: 'KeepAlive' }));
      };
      
      this.socket.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data);
          
          if (response.type === 'Results') {
            if (response.channel && response.channel.alternatives && response.channel.alternatives.length > 0) {
              const transcript = response.channel.alternatives[0].transcript;
              
              if (transcript && transcript.trim()) {
                this.logger.log(`Transcript received (${response.is_final ? 'final' : 'interim'}): ${transcript}`);
                this.onTranscriptReceived(transcript, response.is_final, response);
              }
            }
          } else if (response.type === 'SpeechStarted') {
            this.logger.log('Speech detected by Deepgram');
            this.onSpeechStarted();
          } else if (response.type === 'SpeechFinished') {
            this.logger.log('Speech finished');
            this.onSpeechFinished();
          } else if (response.type === 'Error') {
            this.logger.log(`Deepgram error: ${JSON.stringify(response)}`);
            this.onError(response);
          }
        } catch (error) {
          this.logger.log(`Error parsing Deepgram response: ${error.message}`);
        }
      };
      
      this.socket.onclose = (event) => {
        this.logger.log(`Deepgram WebSocket closed: code=${event.code}, reason=${event.reason}`);
        isConnected = false;
        this.onClose(event);
      };
      
      this.socket.onerror = (error) => {
        this.logger.log(`Deepgram WebSocket error: ${error.message || JSON.stringify(error)}`);
        this.onError(error);
      };
      
      // Wait for connection to be established
      return new Promise((resolve) => {
        if (this.socket.readyState === WebSocket.OPEN) {
          resolve(true);
        } else {
          this.socket.onopen = () => {
            isConnected = true;
            this.logger.log('Deepgram WebSocket connection established');
            resolve(true);
          };
          
          // Add timeout for connection
          setTimeout(() => {
            if (!isConnected) {
              this.logger.log('WebSocket connection timeout');
              resolve(false);
            }
          }, 5000); // 5 second timeout
        }
      });
    } catch (err) {
      this.logger.log(`Failed to setup Deepgram WebSocket: ${err.message}`);
      return Promise.resolve(false);
    }
  }

  /**
   * Sends audio data to Deepgram
   * 
   * @param {Uint8Array} audioData - Audio data to send
   * @returns {boolean} Whether sending was successful
   */
  sendAudio(audioData) {
    try {
      if (!this.socket) {
        this.logger.log('No WebSocket connection exists');
        return false;
      }
      
      if (this.socket.readyState !== WebSocket.OPEN) {
        this.logger.log(`WebSocket not ready for sending: state=${this.getReadyStateName(this.socket.readyState)}`);
        return false;
      }
      
      // Verify audio data is valid before sending
      if (!audioData || audioData.length === 0) {
        this.logger.log('Invalid audio data: empty');
        return false;
      }
      
      // Send a keepalive message before audio to ensure the connection is still active
      try {
        this.socket.send(JSON.stringify({ type: 'KeepAlive' }));
      } catch (keepAliveError) {
        this.logger.log(`Keep-alive failed: ${keepAliveError.message}`);
        // Continue anyway to try sending the actual data
      }
      
      // Send the actual audio data
      this.socket.send(audioData);
      return true;
    } catch (error) {
      this.logger.log(`Error sending audio to Deepgram: ${error.message}`);
      return false;
    }
  }

  /**
   * Gets a readable name for a WebSocket ready state value
   * 
   * @param {number} state - WebSocket ready state
   * @returns {string} Human-readable state name
   */
  getReadyStateName(state) {
    switch (state) {
      case WebSocket.CONNECTING: return 'CONNECTING';
      case WebSocket.OPEN: return 'OPEN';
      case WebSocket.CLOSING: return 'CLOSING';
      case WebSocket.CLOSED: return 'CLOSED';
      default: return `UNKNOWN(${state})`;
    }
  }

  /**
   * Closes the WebSocket connection
   */
  disconnect() {
    try {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        // Send a close stream message
        this.socket.send(JSON.stringify({ type: 'CloseStream' }));
        this.socket.close();
        this.logger.log('Closed Deepgram connection');
      }
    } catch (error) {
      this.logger.log(`Error closing Deepgram connection: ${error.message}`);
    } finally {
      this.socket = null;
    }
  }

  /**
   * Gets the current WebSocket connection state
   * 
   * @returns {number} WebSocket state (CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3)
   */
  getSocketState() {
    if (!this.socket) {
      return WebSocket.CLOSED;
    }
    return this.socket.readyState;
  }
}

export default DeepgramService; 