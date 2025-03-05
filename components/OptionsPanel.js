import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';

/**
 * OptionsPanel component displays configuration toggles for Deepgram settings
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.interimResults - Whether to show interim results
 * @param {Function} props.setInterimResults - Function to toggle interim results
 * @param {boolean} props.smartFormat - Whether to use smart formatting
 * @param {Function} props.setSmartFormat - Function to toggle smart formatting
 * @param {boolean} props.punctuate - Whether to add punctuation
 * @param {Function} props.setPunctuate - Function to toggle punctuation
 * @param {boolean} props.showLogs - Whether to show debug logs
 * @param {Function} props.setShowLogs - Function to toggle debug logs
 * @param {boolean} props.isRecording - Whether recording is in progress
 * @returns {JSX.Element} OptionsPanel component
 */
const OptionsPanel = ({
  interimResults,
  setInterimResults,
  smartFormat,
  setSmartFormat,
  punctuate,
  setPunctuate,
  showLogs,
  setShowLogs,
  isRecording
}) => {
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

const styles = StyleSheet.create({
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
});

export default OptionsPanel; 