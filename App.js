import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Button, SafeAreaView, ActivityIndicator, Switch, ScrollView } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';
import Svg, { Rect } from 'react-native-svg';
import { DEEPGRAM_API_KEY } from '@env';

export default function App() {
  console.log('Deepgram API Key:', DEEPGRAM_API_KEY);
  // Recording state
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [status, setStatus] = useState('');
  const [permission, setPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Debug logs
  const [logs, setLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);
  
  // Audio processing
  const [audioContext, setAudioContext] = useState(null);
  const [audioProcessor, setAudioProcessor] = useState(null);
  
  // Metering state for waveform visualization
  const [meteringValues, setMeteringValues] = useState([]);
  const maxMeteringValues = 100;
  
  // Deepgram configuration
  const [interimResults, setInterimResults] = useState(true);
  const [smartFormat, setSmartFormat] = useState(true);
  const [punctuate, setPunctuate] = useState(true);
  
  // References for streaming
  const deepgramSocketRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const audioBufferRef = useRef([]);
  const meteringIntervalRef = useRef(null);
  
  // Microphone buffer settings
  const BUFFER_SIZE = 4096;
  const SAMPLE_RATE = 16000;
  
  // Deepgram API key - fix circular reference
  const apiKey = DEEPGRAM_API_KEY || '';
  
  // Add a log with timestamp
  const addLog = (message) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(`[${timestamp}] ${message}`);
  };
  
  // Initialize app
  useEffect(() => {
    // Request audio recording permissions
    const getPermissions = async () => {
      try {
        const { granted } = await Audio.requestPermissionsAsync();
        setPermission(granted);
        
        if (granted) {
          // Set up audio recording quality
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
          });
          setStatus('Ready to record');
          addLog('Audio permissions granted, ready to record');
        } else {
          setStatus('Permission not granted to record audio');
          addLog('Audio permissions denied');
        }
      } catch (err) {
        console.error('Failed to get recording permissions', err);
        setStatus('Error: Failed to get permissions');
        addLog(`Permission error: ${err.message}`);
      }
    };
    
    getPermissions();
    
    // Cleanup function
    return () => {
      stopRecording();
    };
  }, []);

  const setupDeepgramSocket = () => {
    try {
      // Validate API key before attempting to connect
      if (!apiKey) {
        addLog('ERROR: Deepgram API Key is undefined or empty');
        setStatus('Error: Missing API Key');
        return null;
      }
      
      // Build the WebSocket URL with all required parameters
      const wsUrl = new URL('wss://api.deepgram.com/v1/listen');
      
      // Use a more reliable encoding to ensure compatibility
      wsUrl.searchParams.append('encoding', 'linear16');
      wsUrl.searchParams.append('sample_rate', '16000'); // Using 16kHz which is better supported
      wsUrl.searchParams.append('channels', '1');
      
      // Add optional parameters based on user settings
      wsUrl.searchParams.append('interim_results', 'false');
      wsUrl.searchParams.append('punctuate', punctuate ? 'true' : 'false');
      wsUrl.searchParams.append('smart_format', smartFormat ? 'true' : 'false');
      
      // Try enhanced-model for better accuracy
      wsUrl.searchParams.append('model', 'general'); // Using more reliable general model instead of nova-2
      wsUrl.searchParams.append('language', 'en-US');
      wsUrl.searchParams.append('endpointing', '800'); // Increased from 500ms to 800ms for better phrase detection
      wsUrl.searchParams.append('vad_events', 'true');
      wsUrl.searchParams.append('continuous', 'true');  // Enable continuous transcription
      
      addLog(`Connecting to Deepgram: ${wsUrl.toString()}`);
      
      const socket = new WebSocket(wsUrl.toString(), [
        'token', apiKey
      ]);

      let isConnected = false;
      
      socket.onopen = () => {
        addLog('Deepgram WebSocket connection established');
        setStatus('Connected to Deepgram');
        isConnected = true;
      };
      
      socket.onmessage = (event) => {
        addLog(`Raw Deepgram response received: ${event.data}`);
        console.log('Raw Deepgram response:', event.data);
        const response = JSON.parse(event.data);
        
        if (response.type) {
          addLog(`Deepgram message type: ${response.type}`);
        }
        
        if (response.type === 'Results') {
          if (response.channel && response.channel.alternatives && response.channel.alternatives.length > 0) {
            const transcript = response.channel.alternatives[0].transcript;
            
            if (transcript && transcript.trim()) {
              addLog(`Transcript received (${response.is_final ? 'final' : 'interim'}): ${transcript}`);
              addLog(`Full response object: ${JSON.stringify(response)}`);
              
              if (response.is_final) {
                // For final results, append to the transcription
                setTranscription(prev => {
                  // Don't add duplicates
                  if (prev.endsWith(transcript)) {
                    addLog('Duplicate transcript detected, skipping');
                    return prev;
                  }
                  
                  // Add proper spacing
                  const needsSpace = prev.length > 0 && 
                                    ![' ', '.', '?', '!', ','].includes(prev[prev.length - 1]);
                  const newTranscription = prev + (needsSpace ? ' ' : '') + transcript;
                  addLog(`Updated transcription: ${newTranscription}`);
                  return newTranscription;
                });
              } else if (interimResults) {
                addLog('Processing interim result');
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
                    addLog(`Updated interim transcription: ${newTranscription}`);
                    return newTranscription;
                  }
                  
                  addLog(`Setting interim transcription: ${transcript}`);
                  return transcript;
                });
              }
            } else {
              addLog('Received empty transcript');
            }
          } else {
            addLog('No alternatives found in response');
          }
        } else if (response.type === 'SpeechStarted') {
          addLog('Speech detected by Deepgram');
          setStatus('Speech detected');
        } else if (response.type === 'SpeechFinished') {
          addLog('Speech finished');
        } else if (response.type === 'Error') {
          addLog(`Deepgram error: ${JSON.stringify(response)}`);
          setStatus('Deepgram error');
        }
      };
      
      socket.onclose = (event) => {
        addLog(`Deepgram WebSocket closed: code=${event.code}, reason=${event.reason}`);
        console.log('Deepgram WebSocket connection closed:', event.code, event.reason);
        setStatus('Disconnected from Deepgram');
        isConnected = false;
        
        // If connection closes unexpectedly during recording, attempt to reconnect
        if (isRecording) {
          addLog('Attempting to reconnect WebSocket...');
          setupDeepgramSocket();
        }
      };
      
      socket.onerror = (error) => {
        addLog(`Deepgram WebSocket error: ${error.message || JSON.stringify(error)}`);
        console.error('Deepgram WebSocket error:', error);
        setStatus('Error connecting to Deepgram');
        isConnected = false;
      };
      
      // Store socket reference
      deepgramSocketRef.current = socket;
      
      // Wait for connection to be established
      return new Promise((resolve) => {
        if (socket.readyState === WebSocket.OPEN) {
          resolve(true);
        } else {
          socket.onopen = () => {
            isConnected = true;
            addLog('Deepgram WebSocket connection established');
            setStatus('Connected to Deepgram');
            resolve(true);
          };
          
          // Add timeout for connection
          setTimeout(() => {
            if (!isConnected) {
              addLog('WebSocket connection timeout');
              resolve(false);
            }
          }, 5000); // 5 second timeout
        }
      });
    } catch (err) {
      addLog(`Failed to setup Deepgram WebSocket: ${err.message}`);
      console.error('Failed to set up Deepgram WebSocket', err);
      setStatus('Error setting up connection');
      return Promise.resolve(false);
    }
  };

  // Start recording with continuous streaming
  const startRecording = async () => {
    try {
      if (!permission) {
        setStatus('Permission not granted to record audio');
        addLog('Cannot start: No audio permission');
        return;
      }
      
      setIsLoading(true);
      setMeteringValues([]);
      setTranscription('');
      setLogs([]);
      
      addLog('Starting new recording session with continuous streaming');
      
      // Set up the WebSocket connection to Deepgram
      const socketReady = await setupDeepgramSocket();
      if (!socketReady) {
        setIsLoading(false);
        addLog('Failed to connect to Deepgram, aborting');
        return;
      }
      
      addLog('WebSocket connection confirmed ready');
      
      const recordingOptions = {
        android: {
          extension: '.wav',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_PCM_16BIT,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_PCM_16BIT,
          sampleRate: SAMPLE_RATE,
          numberOfChannels: 1,
          bitRate: 16 * SAMPLE_RATE,
          meteringEnabled: true,
        },
        ios: {
          extension: '.wav',
          outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_LINEARPCM,
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
          sampleRate: SAMPLE_RATE,
          numberOfChannels: 1,
          bitRate: 16 * SAMPLE_RATE,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
          meteringEnabled: true,
        },
      };
      
      addLog('Starting recording with options: ' + JSON.stringify(recordingOptions));
      
      // Start recording
      const { recording: newRecording } = await Audio.Recording.createAsync(recordingOptions);
      const initialStatus = await newRecording.getStatusAsync();
      addLog(`Initial recording status: ${JSON.stringify(initialStatus)}`);
      
      // Use a ref to store the current recording
      const currentRecordingRef = { current: newRecording };
      setRecording(newRecording);
      setIsRecording(true);
      
      // Start periodic audio streaming (send every 200ms)
      let streamInterval = 0;
      let lastRecordingTime = Date.now();
      
      addLog('Starting recording interval...');
      
      // Clear any existing intervals
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        addLog('Cleared existing recording interval');
      }
      
      // Function to process current recording segment
      const processCurrentSegment = async () => {
        try {
          if (!currentRecordingRef.current) {
            addLog('No recording reference available');
            return;
          }

          const now = Date.now();
          const timeSinceLastRecording = now - lastRecordingTime;
          addLog(`Time since last recording: ${timeSinceLastRecording}ms`);
          
          // Get current status
          const status = await currentRecordingRef.current.getStatusAsync();
          addLog(`Current recording status: ${JSON.stringify(status)}`);
          
          if (!status.isRecording) {
            addLog('Recording is not active, starting new recording');
            try {
              const { recording: nextRecording } = await Audio.Recording.createAsync(recordingOptions);
              currentRecordingRef.current = nextRecording;
              setRecording(nextRecording);
              lastRecordingTime = now;
              addLog('New recording started successfully');
              return;
            } catch (error) {
              addLog(`Failed to start new recording: ${error.message}`);
              return;
            }
          }
          
          // Get URI
          const uri = currentRecordingRef.current.getURI();
          if (!uri) {
            addLog('No URI available for recording');
            return;
          }
          
          addLog(`Processing chunk ${streamInterval}: URI=${uri}`);
          
          // Only process if we've recorded enough audio - increase minimum duration from 100ms to 300ms
          if (status.durationMillis < 500) {
            addLog(`Recording duration too short (${status.durationMillis}ms), waiting for at least 500ms...`);
            return;
          }
          
          try {
            // Stop current recording
            await currentRecordingRef.current.stopAndUnloadAsync();
            addLog('Successfully stopped current recording segment');
            
            // Process the audio
            await processAndSendAudio(uri, streamInterval++);
            
            // Start new recording
            const { recording: nextRecording } = await Audio.Recording.createAsync(recordingOptions);
            const newStatus = await nextRecording.getStatusAsync();
            addLog(`New recording segment started: ${JSON.stringify(newStatus)}`);
            
            // Update references
            currentRecordingRef.current = nextRecording;
            setRecording(nextRecording);
            lastRecordingTime = now;
            
          } catch (error) {
            addLog(`Error in recording cycle: ${error.message}`);
            console.error('Recording cycle error:', error);
            
            // Try to recover by starting a new recording
            try {
              const { recording: recoveryRecording } = await Audio.Recording.createAsync(recordingOptions);
              currentRecordingRef.current = recoveryRecording;
              setRecording(recoveryRecording);
              lastRecordingTime = now;
              addLog('Recovery recording started successfully');
            } catch (recoveryError) {
              addLog(`Failed to start recovery recording: ${recoveryError.message}`);
            }
          }
        } catch (error) {
          addLog(`Error in processCurrentSegment: ${error.message}`);
          console.error('Process segment error:', error);
        }
      };
      
      // Set up the recording interval
      recordingIntervalRef.current = setInterval(processCurrentSegment, 200);
      addLog('Recording interval set up');
      
      // Verify interval is running and initial recording is active
      setTimeout(async () => {
        if (recordingIntervalRef.current) {
          addLog('Recording interval is active');
          try {
            const status = await currentRecordingRef.current.getStatusAsync();
            addLog(`Initial recording verification status: ${JSON.stringify(status)}`);
          } catch (error) {
            addLog(`Error verifying initial recording: ${error.message}`);
          }
        } else {
          addLog('Warning: Recording interval not active');
        }
      }, 300);
      
      // Setup metering updates for visualization
      meteringIntervalRef.current = setInterval(async () => {
        try {
          if (recording) {
            const status = await recording.getStatusAsync();
            if (status.isRecording && status.metering !== undefined) {
              // Convert dB meter value to a 0-1 scale
              const meterLevel = Math.max(-60, status.metering);
              const normalizedValue = (meterLevel + 60) / 60;
              
              // Update waveform visualization
              setMeteringValues(prev => {
                const newValues = [...prev, normalizedValue];
                if (newValues.length > maxMeteringValues) {
                  return newValues.slice(-maxMeteringValues);
                }
                return newValues;
              });
            }
          }
        } catch (err) {
          // Ignore errors from checking metering
        }
      }, 100);
      
      setStatus('Recording with continuous streaming');
      setIsLoading(false);
    } catch (err) {
      addLog(`Failed to start recording: ${err.message}`);
      console.error('Failed to start recording', err);
      setStatus('Error starting recording');
      setIsLoading(false);
      stopRecording();
    }
  };

  // Process and send audio data to Deepgram
  const processAndSendAudio = async (uri, chunkNumber) => {
    try {
      addLog(`Starting to process audio chunk #${chunkNumber}`);
      
      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(uri);
      addLog(`File info for chunk #${chunkNumber}: ${JSON.stringify(fileInfo)}`);
      
      if (!fileInfo.exists) {
        addLog(`File not found: ${uri}`);
        return;
      }
      
      // Skip empty or very small files - increase minimum size to ensure adequate data
      if (fileInfo.size <= 100) { // Changed from 44 to 100
        addLog(`File too small (${fileInfo.size} bytes), skipping`);
        return;
      }
      
      // Read audio data, skipping WAV header
      addLog(`Reading audio data from ${uri}...`);
      let base64Data;
      try {
        base64Data = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
          position: 44, // Skip WAV header
          length: fileInfo.size - 44
        });
        addLog(`Successfully read ${base64Data.length} bytes of base64 data`);
      } catch (readError) {
        addLog(`Error reading audio data: ${readError.message}`);
        console.error('Read error:', readError);
        return;
      }
      
      // Verify WebSocket state
      if (!deepgramSocketRef.current) {
        addLog('WebSocket not initialized, reconnecting...');
        await setupDeepgramSocket();
        return;
      }
      
      if (deepgramSocketRef.current.readyState !== WebSocket.OPEN) {
        addLog(`WebSocket not open (state: ${deepgramSocketRef.current.readyState}), reconnecting...`);
        await setupDeepgramSocket();
        return;
      }
      
      // Convert and send data - improved binary conversion
      try {
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Double-check we have enough data to send
        if (bytes.length < 1000) {
          addLog(`Warning: Audio segment may be too small (${bytes.length} bytes)`);
        }
        
        addLog(`Converted ${bytes.length} bytes to binary`);
        deepgramSocketRef.current.send(bytes);
        addLog(`Successfully sent chunk #${chunkNumber} to Deepgram`);
      } catch (sendError) {
        addLog(`Error sending data: ${sendError.message}`);
        console.error('Send error:', sendError);
        return;
      }
      
      // Cleanup
      try {
        await FileSystem.deleteAsync(uri);
        addLog(`Cleaned up temporary file: ${uri}`);
      } catch (cleanupError) {
        addLog(`Warning: Could not delete temporary file: ${cleanupError.message}`);
      }
    } catch (error) {
      addLog(`Critical error processing audio: ${error.message}`);
      console.error('Critical audio processing error:', error);
    }
  };

  // Stop recording
  const stopRecording = async () => {
    try {
      setIsLoading(true);
      addLog('Stopping recording...');
      
      // Clear intervals
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      
      if (meteringIntervalRef.current) {
        clearInterval(meteringIntervalRef.current);
        meteringIntervalRef.current = null;
      }
      
      // Stop current recording
      if (recording) {
        try {
          await recording.stopAndUnloadAsync();
        } catch (error) {
          addLog(`Error stopping recording: ${error.message}`);
        }
        setRecording(null);
      }
      
      // Close Deepgram WebSocket
      if (deepgramSocketRef.current?.readyState === WebSocket.OPEN) {
        try {
          deepgramSocketRef.current.send(JSON.stringify({ type: 'CloseStream' }));
          deepgramSocketRef.current.close();
          addLog('Closed Deepgram connection');
        } catch (error) {
          addLog(`Error closing WebSocket: ${error.message}`);
        }
        deepgramSocketRef.current = null;
      }
      
      setIsRecording(false);
      setStatus('Stopped recording');
      setIsLoading(false);
    } catch (err) {
      addLog(`Failed to stop recording: ${err.message}`);
      console.error('Failed to stop recording', err);
      setStatus('Error stopping recording');
      setIsLoading(false);
    }
  };

  // Render the waveform from metering values
  const renderWaveform = () => {
    const width = 300;
    const height = 80;
    const barWidth = 2;
    const barGap = 1;
    const maxBars = Math.floor(width / (barWidth + barGap));
    
    if (meteringValues.length === 0) {
      return (
        <View style={styles.waveformPlaceholder}>
          <Text style={styles.waveformPlaceholderText}>Waveform will appear here during recording</Text>
        </View>
      );
    }
    
    // Select a subset of metering values to display
    const displayValues = meteringValues.slice(-maxBars);
    
    return (
      <Svg width={width} height={height} style={styles.waveformSvg}>
        {displayValues.map((value, index) => {
          const barHeight = Math.max(2, value * height);
          const x = index * (barWidth + barGap);
          const y = (height - barHeight) / 2;
          
          return (
            <Rect
              key={`bar-${index}`}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              fill="#007bff"
              rx={1}
              ry={1}
            />
          );
        })}
      </Svg>
    );
  };

  // Render options toggles
  const renderOptions = () => {
    return (
      <View style={styles.optionsContainer}>
        <Text style={styles.optionsTitle}>Transcription Options:</Text>
        
        <View style={styles.optionRow}>
          <Text>Interim Results</Text>
          <Switch
            value={interimResults}
            onValueChange={setInterimResults}
            disabled={isRecording}
          />
        </View>
        
        <View style={styles.optionRow}>
          <Text>Smart Formatting</Text>
          <Switch
            value={smartFormat}
            onValueChange={setSmartFormat}
            disabled={isRecording}
          />
        </View>
        
        <View style={styles.optionRow}>
          <Text>Punctuation</Text>
          <Switch
            value={punctuate}
            onValueChange={setPunctuate}
            disabled={isRecording}
          />
        </View>
        
        <View style={styles.optionRow}>
          <Text>Show Debug Logs</Text>
          <Switch
            value={showLogs}
            onValueChange={setShowLogs}
          />
        </View>
      </View>
    );
  };

  // Render debug logs
  const renderLogs = () => {
    if (!showLogs) return null;
    
    return (
      <View style={styles.logsContainer}>
        <Text style={styles.logsTitle}>Debug Logs ({logs.length}):</Text>
        <ScrollView style={styles.logsScrollView}>
          {logs.map((log, index) => (
            <Text key={index} style={styles.logLine}>{log}</Text>
          ))}
          {logs.length === 0 && (
            <Text style={[styles.logLine, {color: '#999'}]}>No logs yet...</Text>
          )}
        </ScrollView>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.title}>Expo Deepgram Voice Transcription</Text>
        </View>
        
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>Status: {status}</Text>
          <Text style={styles.statusInfo}>
            {isRecording ? 'Continuous streaming mode' : 'Ready to record'}
          </Text>
        </View>
        
        {renderOptions()}
        
        <View style={styles.waveformContainer}>
          <Text style={styles.waveformLabel}>Waveform:</Text>
          {renderWaveform()}
        </View>
        
        <View style={styles.controls}>
          {isLoading ? (
            <ActivityIndicator size="large" color="#0000ff" />
          ) : (
            <>
              {!isRecording ? (
                <Button
                  title="Start Recording"
                  onPress={startRecording}
                  disabled={!permission || isLoading}
                />
              ) : (
                <Button
                  title="Stop Recording"
                  onPress={stopRecording}
                  color="red"
                  disabled={isLoading}
                />
              )}
            </>
          )}
        </View>
        
        <View style={styles.transcriptionContainer}>
          <Text style={styles.transcriptionLabel}>Transcription:</Text>
          <View style={styles.transcriptionTextContainer}>
            <Text style={styles.transcriptionText}>
              {transcription || 'Speak to see transcription here...'}
            </Text>
          </View>
        </View>
        
        {renderLogs()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
    paddingTop: Constants.statusBarHeight,
  },
  header: {
    marginBottom: 15,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
  },
  statusContainer: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#e0e0e0',
    borderRadius: 5,
  },
  statusText: {
    fontSize: 16,
    textAlign: 'center',
  },
  statusInfo: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 5,
    color: '#666',
  },
  optionsContainer: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: 'white',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  optionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  waveformContainer: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: 'white',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  waveformLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  waveformSvg: {
    backgroundColor: '#f8f8f8',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignSelf: 'center',
  },
  waveformPlaceholder: {
    height: 80,
    width: 300,
    backgroundColor: '#f8f8f8',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  waveformPlaceholderText: {
    color: '#999',
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 15,
  },
  transcriptionContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  transcriptionLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  transcriptionTextContainer: {
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    backgroundColor: '#f9f9f9',
    minHeight: 100,
  },
  transcriptionText: {
    fontSize: 16,
    lineHeight: 24,
  },
  logsContainer: {
    backgroundColor: '#333',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  logsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#fff',
  },
  logsScrollView: {
    maxHeight: 200,
  },
  logLine: {
    color: '#0f0',
    fontFamily: 'monospace',
    fontSize: 12,
    marginBottom: 3,
  }
});