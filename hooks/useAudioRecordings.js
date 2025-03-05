import { useState, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { processAudioChunk } from '../services/audioProcessor';

/**
 * Custom hook for handling audio recording functionality.
 * 
 * @param {Object} options - Configuration options
 * @param {Function} options.addLog - Function to add debug logs
 * @param {Function} options.onAudioData - Callback when audio data is available
 * @param {Function} options.onStopRecording - Callback when recording stops
 * @returns {Object} Recording state and functions
 */
export const useAudioRecording = ({ addLog, onAudioData, onStopRecording }) => {
  // Recording state
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [permission, setPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Metering state for waveform visualization
  const [meteringValues, setMeteringValues] = useState([]);
  const maxMeteringValues = 100;
  
  // References for intervals
  const recordingIntervalRef = useRef(null);
  const meteringIntervalRef = useRef(null);
  
  // Microphone buffer settings
  const SAMPLE_RATE = 16000;
  
  // Initialize permissions
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
          addLog('Audio permissions granted, ready to record');
        } else {
          addLog('Audio permissions denied');
        }
      } catch (err) {
        console.error('Failed to get recording permissions', err);
        addLog(`Permission error: ${err.message}`);
      }
    };
    
    getPermissions();
    
    // Cleanup function
    return () => {
      if (isRecording) {
        stopRecording();
      }
    };
  }, []);

  /**
   * Start audio recording with continuous streaming
   */
  const startRecording = async () => {
    try {
      if (!permission) {
        addLog('Cannot start: No audio permission');
        return;
      }
      
      setIsLoading(true);
      setMeteringValues([]);
      addLog('Starting new recording session');
      
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
          
          // Only process if we've recorded enough audio
          if (status.durationMillis < 500) {
            addLog(`Recording duration too short (${status.durationMillis}ms), waiting for at least 500ms...`);
            return;
          }
          
          try {
            // Stop current recording
            await currentRecordingRef.current.stopAndUnloadAsync();
            addLog('Successfully stopped current recording segment');
            
            // Process the audio and call the callback
            const audioData = await processAudioChunk(uri, streamInterval++, addLog);
            if (audioData) {
              onAudioData(audioData);
            }
            
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
      
      setIsLoading(false);
    } catch (err) {
      addLog(`Failed to start recording: ${err.message}`);
      console.error('Failed to start recording', err);
      setIsLoading(false);
      stopRecording();
    }
  };

  /**
   * Stop recording and clean up resources
   */
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
      
      // Call onStopRecording callback
      if (onStopRecording) {
        onStopRecording();
      }
      
      setIsRecording(false);
      setIsLoading(false);
    } catch (err) {
      addLog(`Failed to stop recording: ${err.message}`);
      console.error('Failed to stop recording', err);
      setIsLoading(false);
    }
  };

  return {
    permission,
    isRecording,
    isLoading,
    meteringValues,
    startRecording,
    stopRecording
  };
};