import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Header component displays the application title and optional subtitle
 * 
 * @param {Object} props - Component props
 * @param {string} props.title - The main title text
 * @param {string} [props.subtitle] - Optional subtitle text
 * @returns {JSX.Element} Header component
 */
const Header = ({ title, subtitle }) => {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    marginBottom: 15,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
    marginTop: 5,
  }
});

export default Header; 