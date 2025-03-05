import React, { useState, useEffect } from 'react';
import { SafeAreaView, ScrollView, View } from 'react-native';
import Constants from 'expo-constants';
import { DEEPGRAM_API_KEY } from '@env';

// Components
import Header from './components/Header';
import StatusBar from './components/StatusBar';
import OptionsPanel from './components/OptionsPanel';
import Waveform from './components/Waveform';
import Controls from './components/Controls';
import Transcription from './components/Transcription';
import DebugLogs from './components/DebugLogs';

// Hooks
import useAudioRecording from './hooks/useAudioRecording';
import useDeepgram from './hooks/useDeepgram';
import usePermissions from './hooks/usePermissions';

// Utilities
import createLogger from './utils/logger';
import globalStyles from './styles/globalStyles';

/**
 * Main application component
 * 
 * @returns {JSX.Element} The App component
 */
export default function App() {
  // Debug logs
  const [logs, setLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);
  
  // Create logger
  const logger = createLogger(setLogs);
  
  // Log API key (truncated for security)
  useEffect(() => {
    const apiKeyDisplay = DEEPGRAM_API_KEY 
      ? `${DEEPGRAM_API_KEY.substring(0, 4)}...${DEEPGRAM_API_KEY.substring(DEEPGRAM_API_KEY.length - 4)}`
      : 'Not set';
    logger.log(`Deepgram API Key: ${apiKeyDisplay}`);
  }, []); // Empty dependency array means this runs only once
  
  // Initialize hooks
  const {
    hasPermission,
    requestPermissions
  } = usePermissions({
    onPermissionGranted: () => logger.log('Permissions granted'),
    onPermissionDenied: () => logger.log('Permissions denied'),
    logger
  });
  
  const {
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
  } = useDeepgram({
    apiKey: DEEPGRAM_API_KEY,
    logger
  });
  
  const {
    isRecording,
    isLoading,
    status,
    meteringValues,
    startRecording: startAudioRecording,
    stopRecording: stopAudioRecording
  } = useAudioRecording({
    onAudioData: sendAudioToDeepgram,
    logger
  });
  
  /**
   * Starts the recording and transcription process
   */
  const startRecording = async () => {
    logger.log('Starting recording session');
    
    // Reset state
    clearTranscription();
    setLogs([]);
    
    // Connect to Deepgram
    const connected = await connectToDeepgram();
    if (!connected) {
      logger.log('Failed to connect to Deepgram, aborting');
      return;
    }
    
    // Start recording
    await startAudioRecording();
  };
  
  /**
   * Stops the recording and transcription process
   */
  const stopRecording = async () => {
    logger.log('Stopping recording session');
    
    // Stop recording
    await stopAudioRecording();
    
    // Disconnect from Deepgram
    disconnectFromDeepgram();
  };
  
  // Current status info based on recording state
  const statusInfo = isRecording 
    ? 'Continuous streaming mode' 
    : 'Ready to record';
  
  return (
    <SafeAreaView style={globalStyles.container}>
      <ScrollView>
        <Header 
          title="Expo Deepgram Voice Transcription" 
        />
        
        <StatusBar 
          status={status} 
          info={statusInfo}
        />
        
        <OptionsPanel
          interimResults={interimResults}
          setInterimResults={setInterimResults}
          smartFormat={smartFormat}
          setSmartFormat={setSmartFormat}
          punctuate={punctuate}
          setPunctuate={setPunctuate}
          showLogs={showLogs}
          setShowLogs={setShowLogs}
          isRecording={isRecording}
        />
        
        <Waveform 
          meteringValues={meteringValues}
          isRecording={isRecording}
        />
        
        <Controls
          isRecording={isRecording}
          isLoading={isLoading}
          hasPermission={hasPermission}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
        />
        
        <Transcription 
          text={transcription}
        />
        
        <DebugLogs 
          logs={logs}
          visible={showLogs}
        />
      </ScrollView>
    </SafeAreaView>
  );
}