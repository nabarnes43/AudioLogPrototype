import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

/**
 * DebugLogs component displays application logs for debugging
 * 
 * @param {Object} props - Component props
 * @param {Array<string>} props.logs - Array of log messages
 * @param {boolean} props.visible - Whether logs should be displayed
 * @returns {JSX.Element|null} DebugLogs component or null if not visible
 */
const DebugLogs = ({ logs = [], visible = false }) => {
  if (!visible) return null;
  
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

const styles = StyleSheet.create({
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

export default DebugLogs; 