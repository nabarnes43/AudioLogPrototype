import React from 'react';
import { View, Button, ActivityIndicator, StyleSheet } from 'react-native';

/**
 * Controls component that displays recording control buttons
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.isRecording - Whether recording is in progress
 * @param {boolean} props.isLoading - Whether operation is in progress
 * @param {boolean} props.hasPermission - Whether microphone permission is granted
 * @param {Function} props.onStartRecording - Function to start recording
 * @param {Function} props.onStopRecording - Function to stop recording
 * @returns {JSX.Element} Controls component
 */
const Controls = ({
  isRecording,
  isLoading,
  hasPermission,
  onStartRecording,
  onStopRecording
}) => {
  return (
    <View style={styles.controls}>
      {isLoading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <>
          {!isRecording ? (
            <Button
              title="Start Recording"
              onPress={onStartRecording}
              disabled={!hasPermission || isLoading}
            />
          ) : (
            <Button
              title="Stop Recording"
              onPress={onStopRecording}
              color="red"
              disabled={isLoading}
            />
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 15,
  },
});

export default Controls; 