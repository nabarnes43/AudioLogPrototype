# Expo Deepgram Voice Transcription

A mobile application built with React Native and Expo that provides real-time speech-to-text transcription using the Deepgram API.

## Features

- Real-time voice transcription with Deepgram
- Audio visualization through waveform display
- Configurable transcription options
- Debug logging for development
- Responsive UI for mobile devices

## Project Structure

The application follows a modular architecture for maintainability and separation of concerns:

```
/
├── App.js                 # Main application entry point
├── components/            # Reusable UI components
│   ├── Header.js          # App header
│   ├── StatusBar.js       # Status display
│   ├── OptionsPanel.js    # Configuration toggles
│   ├── Waveform.js        # Audio visualization
│   ├── Controls.js        # Recording controls
│   ├── Transcription.js   # Transcription display
│   └── DebugLogs.js       # Debug logging display
├── hooks/                 # Custom React hooks
│   ├── useAudioRecording.js  # Recording functionality
│   ├── useDeepgram.js        # Deepgram API integration
│   └── usePermissions.js     # Permission handling
├── services/              # External service integrations
│   └── deepgramService.js    # Deepgram API service
├── utils/                 # Utility functions
│   └── logger.js          # Logging utility
└── styles/                # Styling
    └── globalStyles.js    # Shared styles
```

## Getting Started

### Prerequisites

- Node.js (14+ recommended)
- Expo CLI: `npm install -g expo-cli`
- Deepgram API key (get one at [https://deepgram.com](https://deepgram.com))

### Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd expo-deepgram-voice-transcription
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory and add your Deepgram API key:
   ```
   DEEPGRAM_API_KEY=your_api_key_here
   ```

4. Start the Expo development server:
   ```
   expo start
   ```

## Usage

1. Allow microphone permissions when prompted
2. Configure transcription options as needed
3. Tap "Start Recording" to begin transcription
4. Speak into your device's microphone
5. View the transcription in real-time
6. Tap "Stop Recording" when finished

## Configuration Options

- **Interim Results**: Show partial results before a phrase is completed
- **Smart Formatting**: Apply formatting to numbers, dates, and other entities
- **Punctuation**: Automatically add punctuation to the transcription
- **Debug Logs**: Show detailed logs for debugging purposes

## Technical Details

### Audio Processing

The application captures audio in high-quality 16-bit PCM format and streams it to the Deepgram API in chunks for real-time processing. The streaming approach minimizes latency while maintaining transcription accuracy.

### Deepgram Integration

The application connects to Deepgram's WebSocket API for real-time speech recognition. Key parameters include:

- `encoding`: linear16
- `sample_rate`: 16000
- `model`: general
- `language`: en-US

### Error Handling

Robust error handling ensures the application can recover from common issues:

- WebSocket connection errors
- Audio recording interruptions
- Permission issues

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- [Deepgram](https://deepgram.com) for their speech recognition API
- [Expo](https://expo.dev) for the React Native development framework