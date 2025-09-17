// Popup script for Instant Prompt Optimizer - Gemini Cloud API Version
document.addEventListener('DOMContentLoaded', async () => {
  const statusIndicator = document.getElementById('statusIndicator');
  const statusContent = document.getElementById('statusContent');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveApiKeyBtn = document.getElementById('saveApiKey');
  const customWebsiteInput = document.getElementById('customWebsiteInput');
  const addCustomWebsiteBtn = document.getElementById('addCustomWebsite');
  const customWebsitesList = document.getElementById('customWebsitesList');
  
  // Load existing API key and custom websites
  try {
    const result = await chrome.storage.sync.get(['geminiApiKey', 'customWebsites']);
    if (result.geminiApiKey) {
      apiKeyInput.value = result.geminiApiKey;
      hideStatus();
    } else {
      updateStatus('error', 'Please configure your Gemini API key to start optimizing prompts.');
    }
    
    // Load custom websites
    const customWebsites = result.customWebsites || [];
    displayCustomWebsites(customWebsites);
  } catch (error) {
    console.error('Error loading configuration:', error);
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
      
      // Add visual feedback for input validation
      apiKeyInput.classList.remove('valid', 'invalid');
      
      // Test the API key
      const isValid = await testApiKey(apiKey);
      
      if (isValid) {
        // Save the API key
        await chrome.storage.sync.set({ geminiApiKey: apiKey });
        updateStatus('ready', 'API key saved successfully!');
        
        // Visual feedback
        apiKeyInput.classList.add('valid');
        // Hide status after successful save
        hideStatus();
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
  
  // Add custom website functionality
  addCustomWebsiteBtn.addEventListener('click', async () => {
    const website = customWebsiteInput.value.trim();
    
    if (!website) {
      customWebsiteInput.focus();
      customWebsiteInput.classList.add('invalid');
      setTimeout(() => customWebsiteInput.classList.remove('invalid'), 2000);
      return;
    }
    
    // Basic URL validation and cleanup
    let cleanUrl = website.toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '');
    
    if (!cleanUrl || cleanUrl.length < 3 || !cleanUrl.includes('.')) {
      customWebsiteInput.classList.add('invalid');
      customWebsiteInput.focus();
      setTimeout(() => customWebsiteInput.classList.remove('invalid'), 2000);
      return;
    }
    
    // Add loading state
    addCustomWebsiteBtn.disabled = true;
    addCustomWebsiteBtn.innerHTML = `
      <svg class="icon" viewBox="0 0 24 24" style="width: 14px; height: 14px; margin-right: 4px;">
        <path d="M21 12a9 9 0 11-6.219-8.56"/>
      </svg>
      Adding...
    `;
    
    try {
      const result = await chrome.storage.sync.get(['customWebsites']);
      const customWebsites = result.customWebsites || [];
      
      // Check if website already exists
      if (customWebsites.some(site => site.url === cleanUrl)) {
        customWebsiteInput.classList.add('invalid');
        setTimeout(() => customWebsiteInput.classList.remove('invalid'), 2000);
        return;
      }
      
      // Add new website
      customWebsites.push({
        url: cleanUrl,
        name: cleanUrl,
        id: Date.now().toString()
      });
      
      await chrome.storage.sync.set({ customWebsites });
      
      // Success feedback
      customWebsiteInput.classList.add('valid');
      customWebsiteInput.value = '';
      
      displayCustomWebsites(customWebsites);
      
      // Update manifest to include new website
      updateContentScriptMatches(customWebsites);
      
      // Reset input state
      setTimeout(() => {
        customWebsiteInput.classList.remove('valid');
      }, 1000);
      
    } catch (error) {
      console.error('Error adding custom website:', error);
      customWebsiteInput.classList.add('invalid');
      setTimeout(() => customWebsiteInput.classList.remove('invalid'), 2000);
    } finally {
      // Reset button state
      addCustomWebsiteBtn.disabled = false;
      addCustomWebsiteBtn.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24" style="width: 14px; height: 14px; margin-right: 4px;">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Add
      `;
    }
  });
  
  // Allow Enter key to add website
  customWebsiteInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addCustomWebsiteBtn.click();
    }
  });
  
  // Real-time input validation for custom website
  customWebsiteInput.addEventListener('input', (e) => {
    const value = e.target.value.trim();
    customWebsiteInput.classList.remove('valid', 'invalid');
    
    if (value.length === 0) {
      addCustomWebsiteBtn.disabled = false;
      return; // No feedback for empty input
    }
    
    // Clean and validate URL
    let cleanUrl = value.toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '');
    
    // Basic format validation
    if (cleanUrl.length >= 3 && cleanUrl.includes('.') && !cleanUrl.includes(' ')) {
      customWebsiteInput.classList.add('valid');
      addCustomWebsiteBtn.disabled = false;
    } else {
      customWebsiteInput.classList.add('invalid');
      addCustomWebsiteBtn.disabled = true;
    }
  });
  
  function displayCustomWebsites(websites) {
    customWebsitesList.innerHTML = '';
    
    if (websites.length === 0) {
      // No empty state message - just keep the list empty
      return;
    }
    
    websites.forEach((website, index) => {
      const item = document.createElement('div');
      item.className = 'custom-website-item';
      item.style.animationDelay = `${index * 50}ms`;
      item.innerHTML = `
        <div class="custom-website-indicator"></div>
        <div class="custom-website-info">
          <span class="custom-website-url">${website.url}</span>
        </div>
        <button class="remove-website-btn" data-id="${website.id}" title="Remove ${website.url}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      `;
      
      // Add remove functionality with animation
      const removeBtn = item.querySelector('.remove-website-btn');
      removeBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        // Add removing animation
        item.style.transform = 'translateX(100%)';
        item.style.opacity = '0';
        
        setTimeout(async () => {
          try {
            const result = await chrome.storage.sync.get(['customWebsites']);
            const customWebsites = result.customWebsites || [];
            const updatedWebsites = customWebsites.filter(site => site.id !== website.id);
            
            await chrome.storage.sync.set({ customWebsites: updatedWebsites });
            displayCustomWebsites(updatedWebsites);
            updateContentScriptMatches(updatedWebsites);
          } catch (error) {
            console.error('Error removing website:', error);
            // Reset animation on error
            item.style.transform = '';
            item.style.opacity = '';
            alert('Error removing website. Please try again.');
          }
        }, 200);
      });
      
      customWebsitesList.appendChild(item);
    });
  }
  
  async function updateContentScriptMatches(customWebsites) {
    // Send message to background script to update content script matches
    // This would require a background script to dynamically inject content scripts
    try {
      await chrome.runtime.sendMessage({
        action: 'updateCustomWebsites',
        websites: customWebsites
      });
    } catch (error) {
      // Background script might not be available or this feature might not be implemented
      console.log('Background script not available for dynamic content script updates');
    }
  }
  
  function updateStatus(type, message) {
    const statusSection = document.querySelector('.status');
    statusSection.style.display = 'block';
    statusIndicator.className = `status-indicator status-${type}`;
    statusContent.textContent = message;
  }
  
  function hideStatus() {
    const statusSection = document.querySelector('.status');
    statusSection.style.display = 'none';
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
