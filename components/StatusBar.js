import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * StatusBar component that displays the current status of the application
 * 
 * @param {Object} props - Component props
 * @param {string} props.status - The current status text
 * @param {string} [props.info] - Additional information about the status
 * @returns {JSX.Element} StatusBar component
 */
const StatusBar = ({ status, info }) => {
  return (
    <View style={styles.statusContainer}>
      <Text style={styles.statusText}>Status: {status}</Text>
      {info && <Text style={styles.statusInfo}>{info}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
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
});

export default StatusBar; 