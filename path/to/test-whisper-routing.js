// entire file content ...
// ... goes in between

/**
 * Test script to simulate the plugin's flow without Joplin.
 */

const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');

// Define default endpoints based on environment variables
let endpoint;
if (process.env.WHISPER_ENDPOINT === 'http://localhost:11434/api/generate') {
  endpoint = '/api/generate';
} else if (process.env.WHISPER_ENDPOINT === 'http://localhost:1234/v1/audio/transcriptions') {
  endpoint = '/v1/audio/transcriptions';
} else {
  console.error('Invalid WHISPER_ENDPOINT environment variable. Using default Ollama endpoint.');
  endpoint = '/api/generate';
}

// Function to capture audio and transcribe
const captureAndTranscribe = async (model) => {
  const tempFilePath = os.tmpdir() + '/temp_audio.wav';
  await exec(`ffmpeg -f sounddevice -i hw:0 -ac 1 -ar 8000 ${tempFilePath}`, (error) => {
    if (error) throw error;
  });

  try {
    const response = await fetch(`${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        file: URL.createObjectURL(fs.createReadStream(tempFilePath)),
      }),
    });

    const transcriptionData = await response.json();
    fs.writeFileSync(os.tmpdir() + '/transcription.txt', transcriptionData.text);
    console.log('Transcription result:', transcriptionData.text);
  } catch (error) {
    console.error('Error transcribing audio:', error);
  }
};

// Function to generate a dummy WAV file
const createDummyWAV = async () => {
  const tempFilePath = os.tmpdir() + '/temp_audio.wav';
  await exec(`ffmpeg -f sounddevice -i hw:0 -ac 1 -ar 8000 ${tempFilePath}`, (error) => {
    if (error) throw error;
  });

  return tempFilePath;
};

// Example usage
const model = 'your_model_name'; // Replace with your actual model name

try {
  const audioFile = await createDummyWAV();
  await captureAndTranscribe(model);
} catch (error) {
  console.error('Error capturing and transcribing audio:', error);
}
