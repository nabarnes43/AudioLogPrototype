import { useState, useEffect, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

/**
 * Custom hook for handling audio recording functionality
 * 
 * @param {Object} options - Hook options
 * @param {Function} options.onAudioData - Callback when audio data is available
 * @param {Function} options.logger - Logger function for recording events
 * @returns {Object} Recording control methods and state
 */
const useAudioRecording = ({ onAudioData, logger }) => {
  // Recording state
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [permission, setPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  
  // Metering state for waveform visualization
  const [meteringValues, setMeteringValues] = useState([]);
  
  // References for streaming
  const recordingIntervalRef = useRef(null);
  const meteringIntervalRef = useRef(null);
  
  // Audio settings
  const BUFFER_SIZE = 4096;
  const SAMPLE_RATE = 16000;
  
  /**
   * Gets recording permissions from the user
   */
  const getPermissions = useCallback(async () => {
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
        logger?.log('Audio permissions granted, ready to record');
      } else {
        setStatus('Permission not granted to record audio');
        logger?.log('Audio permissions denied');
      }
    } catch (err) {
      console.error('Failed to get recording permissions', err);
      setStatus('Error: Failed to get permissions');
      logger?.log(`Permission error: ${err.message}`);
    }
  }, [logger]);
  
  // Initialize permissions on mount
  useEffect(() => {
    getPermissions();
    
    // Cleanup on unmount
    return () => {
      stopRecording();
    };
  }, []);
  
  /**
   * Process and send audio data from a file
   * 
   * @param {string} uri - URI of the audio file
   * @param {number} chunkNumber - Sequential number of this chunk
   */
  const processAndSendAudio = async (uri, chunkNumber) => {
    try {
      logger?.log(`Starting to process audio chunk #${chunkNumber}`);
      
      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(uri);
      
      if (!fileInfo.exists) {
        logger?.log(`File not found: ${uri}`);
        return;
      }
      
      // Skip empty or very small files
      if (fileInfo.size <= 100) {
        logger?.log(`File too small (${fileInfo.size} bytes), skipping`);
        return;
      }
      
      // Read audio data, skipping WAV header
      logger?.log(`Reading audio data from ${uri}...`);
      let base64Data;
      try {
        base64Data = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
          position: 44, // Skip WAV header
          length: fileInfo.size - 44
        });
        logger?.log(`Successfully read ${base64Data.length} bytes of base64 data`);
      } catch (readError) {
        logger?.log(`Error reading audio data: ${readError.message}`);
        return;
      }
      
      // Convert and send data
      try {
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        logger?.log(`Converted ${bytes.length} bytes to binary`);
        
        // Call the onAudioData callback with the processed audio
        if (onAudioData) {
          await onAudioData(bytes, chunkNumber);
        }
        
      } catch (processError) {
        logger?.log(`Error processing data: ${processError.message}`);
        return;
      }
      
      // Cleanup
      try {
        await FileSystem.deleteAsync(uri);
        logger?.log(`Cleaned up temporary file: ${uri}`);
      } catch (cleanupError) {
        logger?.log(`Warning: Could not delete temporary file: ${cleanupError.message}`);
      }
    } catch (error) {
      logger?.log(`Critical error processing audio: ${error.message}`);
    }
  };
  
  /**
   * Starts recording audio
   */
  const startRecording = async () => {
    try {
      if (!permission) {
        setStatus('Permission not granted to record audio');
        logger?.log('Cannot start: No audio permission');
        return;
      }
      
      setIsLoading(true);
      setMeteringValues([]);
      
      logger?.log('Starting new recording session with continuous streaming');
      
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
      
      logger?.log('Starting recording with options: ' + JSON.stringify(recordingOptions));
      
      // Start recording
      const { recording: newRecording } = await Audio.Recording.createAsync(recordingOptions);
      setRecording(newRecording);
      setIsRecording(true);
      
      // Reference to the current recording
      const currentRecordingRef = { current: newRecording };
      
      // Start periodic audio streaming (send every 200ms)
      let streamInterval = 0;
      let lastRecordingTime = Date.now();
      
      logger?.log('Starting recording interval...');
      
      // Clear any existing intervals
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        logger?.log('Cleared existing recording interval');
      }
      
      // Function to process current recording segment
      const processCurrentSegment = async () => {
        try {
          if (!currentRecordingRef.current) {
            logger?.log('No recording reference available');
            return;
          }

          const now = Date.now();
          const timeSinceLastRecording = now - lastRecordingTime;
          
          // Get current status
          const status = await currentRecordingRef.current.getStatusAsync();
          
          if (!status.isRecording) {
            logger?.log('Recording is not active, starting new recording');
            try {
              const { recording: nextRecording } = await Audio.Recording.createAsync(recordingOptions);
              currentRecordingRef.current = nextRecording;
              setRecording(nextRecording);
              lastRecordingTime = now;
              logger?.log('New recording started successfully');
              return;
            } catch (error) {
              logger?.log(`Failed to start new recording: ${error.message}`);
              return;
            }
          }
          
          // Get URI
          const uri = currentRecordingRef.current.getURI();
          if (!uri) {
            logger?.log('No URI available for recording');
            return;
          }
          
          // Only process if we've recorded enough audio
          if (status.durationMillis < 500) {
            logger?.log(`Recording duration too short (${status.durationMillis}ms), waiting for at least 500ms...`);
            return;
          }
          
          try {
            // Stop current recording
            await currentRecordingRef.current.stopAndUnloadAsync();
            logger?.log('Successfully stopped current recording segment');
            
            // Process the audio
            await processAndSendAudio(uri, streamInterval++);
            
            // Start new recording
            const { recording: nextRecording } = await Audio.Recording.createAsync(recordingOptions);
            currentRecordingRef.current = nextRecording;
            setRecording(nextRecording);
            lastRecordingTime = now;
            
          } catch (error) {
            logger?.log(`Error in recording cycle: ${error.message}`);
            
            // Try to recover by starting a new recording
            try {
              const { recording: recoveryRecording } = await Audio.Recording.createAsync(recordingOptions);
              currentRecordingRef.current = recoveryRecording;
              setRecording(recoveryRecording);
              lastRecordingTime = now;
              logger?.log('Recovery recording started successfully');
            } catch (recoveryError) {
              logger?.log(`Failed to start recovery recording: ${recoveryError.message}`);
            }
          }
        } catch (error) {
          logger?.log(`Error in processCurrentSegment: ${error.message}`);
        }
      };
      
      // Set up the recording interval
      recordingIntervalRef.current = setInterval(processCurrentSegment, 200);
      
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
                // Keep a maximum of 100 values
                if (newValues.length > 100) {
                  return newValues.slice(-100);
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
      logger?.log(`Failed to start recording: ${err.message}`);
      setStatus('Error starting recording');
      setIsLoading(false);
      stopRecording();
    }
  };
  
  /**
   * Stops recording audio
   */
  const stopRecording = async () => {
    try {
      setIsLoading(true);
      logger?.log('Stopping recording...');
      
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
          logger?.log(`Error stopping recording: ${error.message}`);
        }
        setRecording(null);
      }
      
      setIsRecording(false);
      setStatus('Stopped recording');
      setIsLoading(false);
    } catch (err) {
      logger?.log(`Failed to stop recording: ${err.message}`);
      setStatus('Error stopping recording');
      setIsLoading(false);
    }
  };
  
  return {
    isRecording,
    isLoading,
    permission,
    status,
    meteringValues,
    startRecording,
    stopRecording,
    getPermissions,
  };
};

export default useAudioRecording; 