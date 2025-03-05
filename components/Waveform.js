import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

/**
 * Waveform component that visualizes audio levels during recording
 * 
 * @param {Object} props - Component props
 * @param {Array<number>} props.meteringValues - Array of audio level values (0-1)
 * @param {boolean} props.isRecording - Whether recording is in progress
 * @returns {JSX.Element} Waveform component
 */
const Waveform = ({ meteringValues = [], isRecording }) => {
  const width = 300;
  const height = 80;
  const barWidth = 2;
  const barGap = 1;
  const maxBars = Math.floor(width / (barWidth + barGap));
  
  if (meteringValues.length === 0) {
    return (
      <View style={styles.waveformContainer}>
        <Text style={styles.waveformLabel}>Waveform:</Text>
        <View style={styles.waveformPlaceholder}>
          <Text style={styles.waveformPlaceholderText}>
            {isRecording 
              ? 'Processing audio...' 
              : 'Waveform will appear here during recording'}
          </Text>
        </View>
      </View>
    );
  }
  
  // Select a subset of metering values to display
  const displayValues = meteringValues.slice(-maxBars);
  
  return (
    <View style={styles.waveformContainer}>
      <Text style={styles.waveformLabel}>Waveform:</Text>
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
    </View>
  );
};

const styles = StyleSheet.create({
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
    alignSelf: 'center',
  },
  waveformPlaceholderText: {
    color: '#999',
    textAlign: 'center',
  },
});

export default Waveform; 