/**
 * Creates a logger with timestamp functionality
 * 
 * @param {Function} setLogs - State setter for logs array
 * @returns {Object} Logger object with log and clear methods
 */
const createLogger = (setLogs) => {
  /**
   * Adds a timestamped log message to the logs array
   * 
   * @param {string} message - The message to log
   * @param {boolean} [consoleLog=true] - Whether to also log to console
   */
  const log = (message, consoleLog = true) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    const formattedMessage = `[${timestamp}] ${message}`;
    
    setLogs(prev => [...prev, formattedMessage]);
    
    if (consoleLog) {
      console.log(formattedMessage);
    }
  };
  
  /**
   * Clears all logs
   */
  const clear = () => {
    setLogs([]);
  };
  
  return {
    log,
    clear
  };
};

export default createLogger; 