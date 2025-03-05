import { useState, useEffect, useCallback } from 'react';
import { Audio } from 'expo-av';

/**
 * Custom hook for handling audio recording permissions
 * 
 * @param {Object} options - Hook options
 * @param {Function} options.onPermissionGranted - Callback when permission is granted
 * @param {Function} options.onPermissionDenied - Callback when permission is denied
 * @param {Function} options.logger - Logger function for permission events
 * @returns {Object} Permission state and request function
 */
const usePermissions = ({ 
  onPermissionGranted, 
  onPermissionDenied, 
  logger 
}) => {
  // Permission state
  const [hasPermission, setHasPermission] = useState(false);
  
  /**
   * Requests audio recording permissions
   * 
   * @returns {Promise<boolean>} Whether permission was granted
   */
  const requestPermissions = useCallback(async () => {
    try {
      logger?.log('Requesting audio recording permissions...');
      
      const { granted } = await Audio.requestPermissionsAsync();
      setHasPermission(granted);
      
      if (granted) {
        // Set up audio recording quality
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        
        logger?.log('Audio recording permissions granted');
        onPermissionGranted?.();
      } else {
        logger?.log('Audio recording permissions denied');
        onPermissionDenied?.();
      }
      
      return granted;
    } catch (error) {
      logger?.log(`Error requesting permissions: ${error.message}`);
      setHasPermission(false);
      onPermissionDenied?.(error);
      return false;
    }
  }, [onPermissionGranted, onPermissionDenied, logger]);
  
  // Request permissions on mount
  useEffect(() => {
    requestPermissions();
  }, []);
  
  return {
    hasPermission,
    requestPermissions
  };
};

export default usePermissions; 