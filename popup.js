// Popup script for Instant Prompt Optimizer - Gemini Cloud API Version
document.addEventListener('DOMContentLoaded', async () => {
  const statusIndicator = document.getElementById('statusIndicator');
  const statusContent = document.getElementById('statusContent');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveApiKeyBtn = document.getElementById('saveApiKey');
  
  // Load existing API key
  try {
    const result = await chrome.storage.sync.get(['geminiApiKey']);
    if (result.geminiApiKey) {
      apiKeyInput.value = result.geminiApiKey;
      updateStatus('ready', 'API key configured! You can now optimize prompts on supported websites.');
    } else {
      updateStatus('error', 'Please configure your Gemini API key to start optimizing prompts.');
    }
  } catch (error) {
    console.error('Error loading API key:', error);
    updateStatus('error', 'Error loading configuration. Please try again.');
  }
  
  // Save API key functionality
  saveApiKeyBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
      alert('Please enter a valid API key.');
      return;
    }
    
    // Validate API key format (basic check)
    if (!apiKey.startsWith('AIza') || apiKey.length < 30) {
      alert('Invalid API key format. Please check your Gemini API key.');
      return;
    }
    
    try {
      saveApiKeyBtn.disabled = true;
      saveApiKeyBtn.classList.add('loading');
      saveApiKeyBtn.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24" style="width: 14px; height: 14px; margin-right: 4px;">
          <path d="M21 12a9 9 0 11-6.219-8.56"/>
        </svg>
        Saving...
      `;
      
      // Add visual feedback for input validation
      apiKeyInput.classList.remove('valid', 'invalid');
      
      // Test the API key
      const isValid = await testApiKey(apiKey);
      
      if (isValid) {
        // Save the API key
        await chrome.storage.sync.set({ geminiApiKey: apiKey });
        updateStatus('ready', 'API key saved successfully! You can now optimize prompts on supported websites.');
        
        // Visual feedback
        apiKeyInput.classList.add('valid');
        saveApiKeyBtn.classList.remove('loading');
        saveApiKeyBtn.classList.add('success');
        saveApiKeyBtn.innerHTML = `
          <svg class="icon" viewBox="0 0 24 24" style="width: 14px; height: 14px; margin-right: 4px;">
            <polyline points="20,6 9,17 4,12"/>
          </svg>
          Saved!
        `;
        
        setTimeout(() => {
          saveApiKeyBtn.classList.remove('success');
          saveApiKeyBtn.innerHTML = `
            <svg class="icon" viewBox="0 0 24 24" style="width: 14px; height: 14px; margin-right: 4px;">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17,21 17,13 7,13 7,21"/>
              <polyline points="7,3 7,8 15,8"/>
            </svg>
            Save
          `;
        }, 2000);
      } else {
        apiKeyInput.classList.add('invalid');
        updateStatus('error', 'Invalid API key. Please check your Gemini API key and try again.');
        alert('API key validation failed. Please check your key and try again.');
      }
    } catch (error) {
      console.error('Error saving API key:', error);
      apiKeyInput.classList.add('invalid');
      updateStatus('error', 'Error saving API key. Please try again.');
      alert('Error saving API key. Please try again.');
    } finally {
      saveApiKeyBtn.disabled = false;
      saveApiKeyBtn.classList.remove('loading');
      if (saveApiKeyBtn.innerHTML.includes('Saving...')) {
        saveApiKeyBtn.innerHTML = `
          <svg class="icon" viewBox="0 0 24 24" style="width: 14px; height: 14px; margin-right: 4px;">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17,21 17,13 7,13 7,21"/>
            <polyline points="7,3 7,8 15,8"/>
          </svg>
          Save
        `;
      }
    }
  });
  
  // Allow Enter key to save
  apiKeyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveApiKeyBtn.click();
    }
  });
  
  // Real-time input validation feedback
  apiKeyInput.addEventListener('input', (e) => {
    const value = e.target.value.trim();
    apiKeyInput.classList.remove('valid', 'invalid');
    
    if (value.length === 0) {
      return; // No feedback for empty input
    }
    
    // Basic format validation
    if (value.startsWith('AIza') && value.length >= 30) {
      apiKeyInput.classList.add('valid');
    } else {
      apiKeyInput.classList.add('invalid');
    }
  });
  
  function updateStatus(type, message) {
    statusIndicator.className = `status-indicator status-${type}`;
    statusContent.textContent = message;
  }
  
  async function testApiKey(apiKey) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: 'Hello'
                }
              ]
            }
          ]
        })
      });
      
      return response.ok;
    } catch (error) {
      console.error('API key test failed:', error);
      return false;
    }
  }
});
