import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

/**
 * Transcription component displays the transcribed speech text
 * 
 * @param {Object} props - Component props
 * @param {string} props.text - The transcription text to display
 * @returns {JSX.Element} Transcription component
 */
const Transcription = ({ text }) => {
  return (
    <View style={styles.transcriptionContainer}>
      <Text style={styles.transcriptionLabel}>Transcription:</Text>
      <ScrollView style={styles.transcriptionScrollView}>
        <View style={styles.transcriptionTextContainer}>
          <Text style={styles.transcriptionText}>
            {text || 'Speak to see transcription here...'}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
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
  transcriptionScrollView: {
    maxHeight: 150,
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
});

export default Transcription; 