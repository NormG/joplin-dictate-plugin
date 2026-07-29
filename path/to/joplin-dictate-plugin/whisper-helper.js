// entire file content ...
// ... goes in between

const { exec } = require('child_process');
const fs = require('fs');

/**
 * Helper function to capture audio and transcribe using Whisper.
 *
 * @param {string} model - The model name for the API request.
 * @returns {Promise<{success: boolean, transcriptionId: string}>} - A promise that resolves with a success status and transcription ID.
 */
const captureAndTranscribe = async (model) => {
  const audioFilePath = await captureAudio();
  if (!audioFilePath) return { success: false, transcriptionId: '' };

  try {
    const response = await fetch(`/${process.env.WHISPER_ENDPOINT}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        file: URL.createObjectURL(fs.createReadStream(audioFilePath)),
      }),
    });

    const transcriptionData = await response.json();
    fs.writeFileSync(os.tmpdir() + '/transcription.txt', transcriptionData.text);
    return { success: true, transcriptionId: transcriptionData.transcriptionId };
  } catch (error) {
    console.error('Error transcribing audio:', error);
    return { success: false, transcriptionId: '' };
  }
};

/**
 * Helper function to capture audio using ffmpeg or arecord.
 *
 * @returns {Promise<string>} - A promise that resolves with the path of the captured audio file.
 */
const captureAudio = async () => {
  const tempFilePath = os.tmpdir() + '/temp_audio.wav';
  await exec(`ffmpeg -f sounddevice -i hw:0 -ac 1 -ar 8000 ${tempFilePath}`, (error) => {
    if (error) throw error;
  });

  return tempFilePath;
};

module.exports = { captureAndTranscribe, captureAudio };
