// entire file content ...
// ... goes in between

/**
 * Helper function to generate Whisper response.
 *
 * @param {string} model - The model name for the API request.
 * @param {File | Blob} audioFile - The audio file to transcribe.
 * @returns {Promise<{text: string, transcriptionId: string}>} - A promise that resolves with the text and transcription ID.
 */
const generateWhisperResponse = async (model, audioFile) => {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      file: URL.createObjectURL(audioFile),
    }),
  });

  return response.json();
};

/**
 * Helper function to generate audio transcription using OpenAI-compatible API.
 *
 * @param {string} model - The model name for the API request.
 * @param {File | Blob} audioFile - The audio file to transcribe.
 * @returns {Promise<{text: string, transcriptionId: string}>} - A promise that resolves with the text and transcription ID.
 */
const generateAudioResponse = async (model, audioFile) => {
  const response = await fetch('/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer YOUR_API_KEY`, // Replace with your actual API key
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      file: URL.createObjectURL(audioFile),
    }),
  });

  return response.json();
};

/**
 * Function to handle the transcription process.
 *
 * @param {string} model - The model name for the API request.
 * @param {File | Blob} audioFile - The audio file to transcribe.
 * @returns {Promise<{text: string, transcriptionId: string}>} - A promise that resolves with the text and transcription ID.
 */
const handleTranscription = async (model, audioFile) => {
  const whisperResponse = await generateWhisperResponse(model, audioFile);
  const openAiResponse = await generateAudioResponse(model, audioFile);

  // Assuming both responses have a 'text' field
  return { text: whisperResponse.text || openAiResponse.text, transcriptionId: openAiResponse.transcriptionId };
};

// Example usage:
const fileInput = document.getElementById('audio-file-input');
fileInput.addEventListener('change', async (event) => {
  const audioFile = event.target.files[0];
  if (!audioFile) return;

  const { text, transcriptionId } = await handleTranscription('your_model_name', audioFile);
  console.log(text); // Transcribed text
  console.log(transcriptionId); // Transcription ID for further use
});
