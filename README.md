# Instant Prompt Optimizer Chrome Extension

A Chrome extension that helps you instantly optimize your prompts for better AI conversations. Simply highlight text on AI websites and get an improved, more effective prompt using Google's Gemini AI.

## ✨ Features

- **Smart Text Selection**: Highlight any text on supported AI websites
- **AI-Powered Optimization**: Uses Google's Gemini Cloud API to improve your prompts
- **Instant Replacement**: Replace original text with optimized prompts directly in input fields
- **Copy to Clipboard**: Easily copy optimized prompts for use elsewhere
- **Multi-site Support**: Works on Claude, ChatGPT, Gemini, and Perplexity

## 🌐 Supported Websites

- [Claude.ai](https://claude.ai)
- [ChatGPT](https://chatgpt.com)
- [Google Gemini](https://gemini.google.com)
- [Perplexity](https://www.perplexity.ai)

## 📋 Requirements

### Chrome Browser Requirements
- **Chrome Version**: Any modern Chrome browser (v88+)
- **Operating System**: Windows, macOS, Linux, ChromeOS
- **Network**: Internet connection for API calls
- **Gemini API Key**: Free API key from Google AI Studio

### Get Your Free Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy your API key
5. Paste it into the extension popup

## 🚀 Installation

### Option 1: Load as Unpacked Extension (Development)

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The extension should now appear in your extensions list

### Option 2: Add Icons (Optional)

For a better visual experience, add icon files to the `icons/` directory:
- `icon16.png` (16x16 pixels)
- `icon32.png` (32x32 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

Then update the manifest.json to include the icons section.

## 📖 How to Use

1. **Configure your API key**:
   - Click the extension icon in Chrome
   - Enter your Gemini API key
   - Click "Save"

2. **Visit a supported AI website** (Claude, ChatGPT, Gemini, or Perplexity)

3. **Highlight text** you want to optimize - this could be:
   - A rough draft of your question
   - Text with grammar issues
   - A prompt that needs to be more specific
   - Any text you want to improve for AI interaction

4. **Click "Optimize Prompt"** in the popup that appears

5. **Wait for AI processing** - the extension will use Google's Gemini AI to improve your text

6. **Use the optimized prompt**:
   - Click "Replace Text" to automatically insert it into the input field
   - Click "Copy Optimized" to copy it to your clipboard
   - Or manually copy the improved text

## 🎯 Example Use Cases

- **Grammar Correction**: "can you help me write email to boss about vacation request" → "Could you help me write a professional email to my boss requesting vacation time?"

- **Making Prompts More Specific**: "write code" → "Please write a Python function that takes a list of numbers and returns the average, including error handling for empty lists."

- **Adding Context**: "fix this bug" → "Please help me debug this JavaScript error. The function should validate user input but is throwing an undefined error on line 23."

## 🔧 Technical Details

- **AI Model**: Uses Google's Gemini 1.5 Flash via Cloud API
- **Privacy**: Text is sent to Google's API for processing (standard API usage)
- **Performance**: Fast cloud-based processing with reliable results
- **Compatibility**: Works with any modern Chrome browser

## 🐛 Troubleshooting

### Extension Not Working
1. Make sure your Gemini API key is configured correctly
2. Check your internet connection
3. Verify the extension is enabled in `chrome://extensions/`

### "API Key Invalid" Error
1. Double-check your API key from Google AI Studio
2. Make sure you copied the complete key
3. Verify your Google Cloud account has API access enabled

### Popup Not Appearing
1. Try highlighting text again
2. Make sure you're on a supported website
3. Check if the extension is enabled in `chrome://extensions/`

### Optimized Text Not Inserting
1. Use the "Copy Optimized" button as a fallback
2. Try manually pasting the optimized text
3. Some websites may have specific input field restrictions

### API Quota Issues
1. Check your Gemini API usage in Google AI Studio
2. Free tier has rate limits - consider upgrading if needed
3. Wait a few minutes if you hit rate limits

## 🔒 Privacy & Security

- **API Processing**: Text is processed via Google's Gemini API (follows Google's privacy policy)
- **No Data Storage**: The extension doesn't store your text - only the API key locally
- **Minimal Permissions**: Only requests access to supported AI websites and storage for API key
- **Open Source**: Code is available for review and audit
- **Secure API**: Uses HTTPS for all API communications

## 🤝 Contributing

Feel free to contribute to this project by:
- Reporting bugs or issues
- Suggesting new features
- Adding support for more websites
- Improving the UI/UX
- Optimizing performance

## 📄 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

- Built using Chrome's experimental Prompt API
- Inspired by the need for better AI prompt engineering
- Thanks to the Chrome team for making local AI accessible to developers

---

**Note**: This extension requires a free Gemini API key from Google AI Studio. The free tier includes generous usage limits for personal use.
