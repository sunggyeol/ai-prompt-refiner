// Instant Prompt Optimizer Content Script - Gemini Cloud API Version
class PromptOptimizer {
  constructor() {
    this.selectedText = '';
    this.selectionRange = null;
    this.optimizationPopup = null;
    this.apiKey = null;
    this.isOptimizing = false; // Track if an optimizing request is in progress
    this.justClosed = false; // Track if popup was just closed to prevent immediate reopening
    
    this.init();
  }

  async init() {
    // Load API key from storage
    try {
      const result = await chrome.storage.sync.get(['geminiApiKey']);
      this.apiKey = result.geminiApiKey;
      
      if (!this.apiKey) {
        console.warn('Instant Prompt Optimizer: No Gemini API key found. Please configure in extension popup.');
      }
    } catch (error) {
      console.error('Instant Prompt Optimizer: Error loading API key:', error);
    }

    // Try to restore any pending optimization state
    await this.restoreOptimizationState();

    // Set up event listeners
    document.addEventListener('mouseup', this.handleTextSelection.bind(this));
    document.addEventListener('keyup', this.handleTextSelection.bind(this));
    document.addEventListener('mousedown', this.handleMouseDown.bind(this));
    
    // Listen for API key updates
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.geminiApiKey) {
        this.apiKey = changes.geminiApiKey.newValue;
      }
    });
    
    // Clean up old optimization data (older than 1 hour)
    this.cleanupOldOptimizations();
  }

  handleTextSelection(event) {
    // Prevent handling new selections during active refinement
    if (this.isOptimizing) {
      return;
    }
    
    // Prevent reopening immediately after closing
    if (this.justClosed) {
      return;
    }
    
    // Small delay to ensure selection is complete
    setTimeout(() => {
      // Double-check optimization state and close state after timeout
      if (this.isOptimizing || this.justClosed) {
        return;
      }
      
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();
      
      if (selectedText.length > 0 && selectedText.length < 500000) {
        // Check if the selection is within an input field
        if (!this.isSelectionInInputField(selection)) {
          console.log('Instant Prompt Optimizer: Selection not in input field, ignoring');
          this.hidePopup();
          return;
        }
        
        // Check if the input field itself is empty or only contains the selected text
        // This prevents showing popup when user deletes text after replacement
        if (!this.isInputFieldContentValid(selection, selectedText)) {
          console.log('Instant Prompt Optimizer: Input field is empty or invalid, ignoring');
          this.hidePopup();
          this.clearCachedOptimization();
          return;
        }
        
        // If this is a new selection different from cached one, clear the cache
        if (this.selectedText && this.selectedText !== selectedText) {
          this.clearCachedOptimization();
        }
        
        this.selectedText = selectedText;
        
        // For very long text, use a more robust range selection
        let selectionRange = null;
        try {
          if (selection.rangeCount > 0) {
            selectionRange = selection.getRangeAt(0).cloneRange();
          }
        } catch (error) {
          console.log('Could not get selection range:', error);
        }
        
        this.selectionRange = selectionRange;
        
        // Store additional selection info for input fields
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT')) {
          this.selectionStart = activeElement.selectionStart;
          this.selectionEnd = activeElement.selectionEnd;
          this.targetElement = activeElement;
        } else {
          this.selectionStart = null;
          this.selectionEnd = null;
          this.targetElement = null;
        }
        
        console.log(`Instant Prompt Optimizer: Showing popup for ${selectedText.length} characters in input field`);
        this.showOptimizationOptions(event);
      } else {
        if (selectedText.length >= 500000) {
          console.log(`Instant Prompt Optimizer: Text too long (${selectedText.length} chars), max is 500,000`);
        } else if (selectedText.length === 0) {
          console.log('Instant Prompt Optimizer: No text selected, clearing any cached optimization');
          this.clearCachedOptimization();
        }
        this.hidePopup();
      }
    }, 10);
  }

  getOptimizeButtonText() {
    const isLargeText = this.selectedText.length > 10000;
    const isShortSentence = this.selectedText.length < 100 && this.selectedText.split(/[.!?]+/).length <= 2;
    
    if (isShortSentence) {
      return 'Improve Grammar & Clarity';
    } else if (isLargeText) {
      return 'Optimize for AI Understanding';
    } else {
      return 'Optimize Text';
    }
  }

  getHeaderTitle() {
    return 'Instant Prompt Optimizer';
  }

  showOptimizationOptions(event) {
    // Prevent creating new popups during active optimization
    if (this.isOptimizing) {
      return;
    }
    
    // Check if a popup already exists in the DOM and remove it
    const existingPopup = document.querySelector('.prompt-optimizer-popup');
    if (existingPopup) {
      console.log('Instant Prompt Optimizer: Found existing popup, removing it');
      existingPopup.remove();
    }
    
    this.hidePopup(); // Remove any existing popup
    
    // Get selection rectangle, with fallback for long text
    let rect;
    try {
      if (this.selectionRange) {
        rect = this.selectionRange.getBoundingClientRect();
      } else {
        // Fallback: use current selection or cursor position
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          rect = selection.getRangeAt(0).getBoundingClientRect();
        } else {
          // Last resort: position near cursor or center of viewport
          rect = {
            top: window.scrollY + window.innerHeight / 3,
            left: window.scrollX + window.innerWidth / 2 - 160,
            bottom: window.scrollY + window.innerHeight / 3 + 20,
            right: window.scrollX + window.innerWidth / 2 + 160,
            width: 320,
            height: 20
          };
        }
      }
    } catch (error) {
      console.log('Error getting selection rect:', error);
      // Fallback positioning
      rect = {
        top: window.scrollY + window.innerHeight / 3,
        left: window.scrollX + window.innerWidth / 2 - 160,
        bottom: window.scrollY + window.innerHeight / 3 + 20,
        right: window.scrollX + window.innerWidth / 2 + 160,
        width: 320,
        height: 20
      };
    }
    
    this.optimizationPopup = document.createElement('div');
    this.optimizationPopup.className = 'prompt-optimizer-popup';
    this.optimizationPopup.innerHTML = `
      <div class="prompt-optimizer-content">
        <div class="prompt-optimizer-header">
          <span class="prompt-optimizer-title":
            <svg class="header-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10,9 9,9 8,9"/>
            </svg>
            ${this.getHeaderTitle()}
          </span>
          <button class="prompt-optimizer-close" id="closeOptimizer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="prompt-optimizer-info">
          <small>Selected: ${this.selectedText.length.toLocaleString()} characters${
            this.selectedText.length > 100000 ? ' (very large document)' :
            this.selectedText.length > 50000 ? ' (large document)' :
            this.selectedText.length > 10000 ? ' (large text)' : ''
          }</small>
        </div>
        <div class="prompt-optimizer-buttons">
          <button id="optimizeBtn" class="prompt-optimizer-btn primary">
            <svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            ${this.getOptimizeButtonText()}
          </button>
          <button id="replaceBtn" class="prompt-optimizer-btn primary" style="display: none;">
            <svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20,6 9,17 4,12"/>
            </svg>
            Replace Text
          </button>
          <button id="copyBtn" class="prompt-optimizer-btn secondary" style="display: none;">
            <svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copy Optimized
          </button>
        </div>
        <div id="optimizedText" class="prompt-optimizer-result" style="display: none;"></div>
        <div id="loadingIndicator" class="prompt-optimizer-loading" style="display: none;">
          <div class="spinner"></div>
          <span id="loadingMessage">Optimizing your prompt for AI understanding...</span>
        </div>
        ${!this.apiKey ? '<div class="prompt-optimizer-error">⚠️ Please configure Gemini API key in extension popup</div>' : ''}
      </div>
    `;
    
    // Position the popup intelligently
    this.positionPopup(this.optimizationPopup, rect);
    
    document.body.appendChild(this.optimizationPopup);
    
    // Add event listeners
    document.getElementById('optimizeBtn').addEventListener('click', this.optimizePrompt.bind(this));
    document.getElementById('replaceBtn').addEventListener('click', this.replaceText.bind(this));
    document.getElementById('copyBtn').addEventListener('click', this.copyOptimizedText.bind(this));
    document.getElementById('closeOptimizer').addEventListener('click', this.handleCloseClick.bind(this));
    
    // Prevent popup from closing when clicking inside it
    this.optimizationPopup.addEventListener('mousedown', (e) => e.stopPropagation());
    
    // Add window event listeners for responsive repositioning
    this.addRepositioningEventListeners();
    
    // Check if we have a cached optimization for this text
    this.checkForCachedOptimization();
  }

  async optimizePrompt() {
    // Prevent multiple simultaneous requests
    if (this.isOptimizing) {
      return;
    }

    if (!this.apiKey) {
      alert('Please configure your Gemini API key in the extension popup first.');
      return;
    }

    const loadingIndicator = document.getElementById('loadingIndicator');
    const optimizeBtn = document.getElementById('optimizeBtn');
    const optimizedTextDiv = document.getElementById('optimizedText');
    
    // Set optimizing state to prevent multiple requests
    this.isOptimizing = true;
    
    // Create a unique key for this optimization session
    const sessionKey = `optimization_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Show loading state with appropriate message
    const isLargeText = this.selectedText.length > 10000;
    const isVeryLargeText = this.selectedText.length > 50000;
    const isShortSentence = this.selectedText.length < 100 && this.selectedText.split(/[.!?]+/).length <= 2;
    const loadingMessage = document.getElementById('loadingMessage');
    
    if (isShortSentence) {
      loadingMessage.textContent = 'Improving grammar and clarity...';
    } else if (isVeryLargeText) {
      loadingMessage.textContent = 'Processing large document, this may take up to a minute...';
    } else if (isLargeText) {
      loadingMessage.textContent = 'Structuring for better AI understanding, this may take a moment...';
    } else {
      loadingMessage.textContent = 'Optimizing your text...';
    }
    
    loadingIndicator.style.display = 'flex';
    optimizeBtn.disabled = true;
    optimizeBtn.classList.add('loading');
    optimizeBtn.innerHTML = `
      <svg class="btn-icon spinner-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12a9 9 0 11-6.219-8.56"/>
      </svg>
      <span>Optimizing...</span>
    `;
    
    // Disable other buttons during loading
    const replaceBtn = document.getElementById('replaceBtn');
    const copyBtn = document.getElementById('copyBtn');
    if (replaceBtn) replaceBtn.disabled = true;
    if (copyBtn) copyBtn.disabled = true;
    
    try {
      const optimizedPrompt = await this.callGeminiAPI(this.selectedText);
      
      // Store optimization result in both memory and persistent storage
      this.optimizedPrompt = optimizedPrompt;
      this.currentSessionKey = sessionKey;
      
      // Save to chrome storage for persistence across tab switches
      const optimizationData = {
        originalText: this.selectedText,
        optimizedText: optimizedPrompt,
        timestamp: Date.now(),
        url: window.location.href,
        sessionKey: sessionKey
      };
      
      await chrome.storage.local.set({
        [sessionKey]: optimizationData,
        currentOptimization: sessionKey
      });
      
      // Display the optimized prompt
      optimizedTextDiv.textContent = optimizedPrompt;
      optimizedTextDiv.style.display = 'block';
      
      // Hide the optimize button and show action buttons
      optimizeBtn.style.display = 'none';
      document.getElementById('replaceBtn').style.display = 'inline-flex';
      document.getElementById('copyBtn').style.display = 'inline-flex';
      
      // Reposition popup after content is added to prevent overflow
      setTimeout(() => {
        this.repositionPopupAfterExpansion();
      }, 50);
      
    } catch (error) {
      console.error('Instant Prompt Optimizer: Error optimizing prompt:', error);
      
      let errorMessage = 'Error optimizing prompt. ';
      if (error.message.includes('API_KEY_INVALID')) {
        errorMessage += 'Invalid API key. Please check your Gemini API key.';
      } else if (error.message.includes('QUOTA_EXCEEDED')) {
        errorMessage += 'API quota exceeded. Please check your Gemini API usage.';
      } else {
        errorMessage += 'Please try again.';
      }
      
      alert(errorMessage);
      
      // Reposition popup after error message might be shown
      setTimeout(() => {
        this.repositionPopupAfterExpansion();
      }, 50);
    } finally {
      // Reset optimizing state
      this.isOptimizing = false;
      
      // Hide loading state
      loadingIndicator.style.display = 'none';
      optimizeBtn.disabled = false;
      optimizeBtn.classList.remove('loading');
      optimizeBtn.innerHTML = `
        <svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
Optimize for AI Understanding
      `;
      
      // Re-enable other buttons
      const replaceBtn = document.getElementById('replaceBtn');
      const copyBtn = document.getElementById('copyBtn');
      if (replaceBtn) replaceBtn.disabled = false;
      if (copyBtn) copyBtn.disabled = false;
    }
  }

  async callGeminiAPI(text) {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent?key=${this.apiKey}`;
    
    // Determine optimization approach based on text length and complexity
    const isLargeText = text.length > 10000;
    const isShortSentence = text.length < 100 && text.split(/[.!?]+/).length <= 2;
    
    let prompt;
    
    if (isShortSentence) {
      // For short sentences, focus on grammar and clarity
      prompt = `You are a grammar and clarity expert. Your task is to improve this text by focusing ONLY on:

1. Fixing grammar, spelling, and punctuation errors
2. Improving sentence structure for better readability
3. Using clearer, more precise language
4. Maintaining the exact original meaning and intent

Do NOT:
- Add new content or requirements
- Change the core message or intent
- Make it more complex or verbose
- Add context that wasn't originally there

Please improve this text: "${text}"

Respond with only the improved text, nothing else.`;
    } else if (isLargeText) {
      // For large text, optimize for LLM consumption
      prompt = `You are an AI prompt optimization expert. Transform this text into a clear, well-structured prompt that LLMs can easily understand and follow by:

- Breaking down complex requests into clear, numbered steps
- Using specific, unambiguous language
- Organizing information in a logical hierarchy
- Adding necessary context for clarity
- Structuring as clear instructions or requests

Text to optimize:
"${text}"

Return only the LLM-optimized version:`;
    } else {
      // For medium-length text, balance both approaches
      prompt = `You are a communication expert. Optimize this text to be clearer and more effective by:

1. Fixing any grammar, spelling, or clarity issues
2. Making the request more specific and actionable
3. Structuring information logically
4. Maintaining the exact original intent

Text to optimize: "${text}"

Respond with only the optimized text, nothing else.`;
    }

    // Adjust parameters based on text length - be generous with Gemini's 1M context window
    const maxTokens = text.length > 50000 ? 8192 : 
                     text.length > 10000 ? 4096 : 
                     text.length > 1000 ? 2048 : 1024;
    
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: maxTokens,
        candidateCount: 1
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH", 
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
      ]
    };

    // Add timeout for large text processing - be more generous for very large texts
    const timeoutMs = text.length > 100000 ? 120000 : // 2 minutes for very large texts
                     text.length > 50000 ? 90000 :   // 1.5 minutes for large texts
                     text.length > 10000 ? 60000 :   // 1 minute for medium-large texts
                     30000; // 30s for normal texts
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API request failed: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid response from Gemini API');
      }

      return data.candidates[0].content.parts[0].text.trim();
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout - large text processing took too long. Try with smaller text or try again later.`);
      }
      throw error;
    }
  }

  replaceText() {
    if (!this.optimizedPrompt) return;
    
    // Find the nearest input field or textarea
    const inputField = this.findNearestInputField();
    
    if (inputField) {
      console.log('Instant Prompt Optimizer: Found input field:', inputField.tagName, inputField);
      
      // Handle different types of input elements
      if (inputField.contentEditable === 'true') {
        console.log('Instant Prompt Optimizer: Replacing in contenteditable element');
        this.replaceInContentEditable(inputField);
      } else if (inputField.tagName === 'TEXTAREA' || inputField.tagName === 'INPUT') {
        console.log('Instant Prompt Optimizer: Replacing in textarea/input element');
        this.replaceInTextInput(inputField);
      } else {
        console.log('Instant Prompt Optimizer: Unknown input type, copying to clipboard');
        this.copyOptimizedText();
        return;
      }
      
      this.hidePopup();
      
      // Clear the stored optimization since text has been replaced
      this.clearStoredOptimization();
    } else {
      console.log('Instant Prompt Optimizer: No input field found, copying to clipboard');
      this.copyOptimizedText();
    }
  }


  replaceInContentEditable(element) {
    // For contenteditable elements (like Claude.ai)
    const currentText = element.textContent || element.innerText || '';
    
    // Method 1: Try to replace only the selected text within existing content
    if (currentText.includes(this.selectedText)) {
      // Replace only the first occurrence of the selected text
      const newText = currentText.replace(this.selectedText, this.optimizedPrompt);
      element.textContent = newText;
      
      // Calculate cursor position after replacement
      const beforeSelected = currentText.indexOf(this.selectedText);
      const newCursorPos = beforeSelected + this.optimizedPrompt.length;
      
      // Set cursor position after the replaced text
      setTimeout(() => {
        element.focus();
        try {
          const range = document.createRange();
          const sel = window.getSelection();
          
          // Try to set cursor position within the text
          if (element.firstChild && element.firstChild.nodeType === Node.TEXT_NODE) {
            const textNode = element.firstChild;
            const safePos = Math.min(newCursorPos, textNode.textContent.length);
            range.setStart(textNode, safePos);
            range.setEnd(textNode, safePos);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        } catch (e) {
          // Fallback: place cursor at end
          const range = document.createRange();
          const sel = window.getSelection();
          range.selectNodeContents(element);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }, 10);
    } else {
      // Fallback: If we can't find the exact selected text, try using selection range
      element.focus();
      
      // Try to use the stored selection range if it's still valid
      if (this.selectionRange) {
        try {
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(this.selectionRange);
          document.execCommand('insertText', false, this.optimizedPrompt);
        } catch (e) {
          // Final fallback: replace entire content
          element.textContent = this.optimizedPrompt;
        }
      } else {
        // Final fallback: replace entire content
        element.textContent = this.optimizedPrompt;
      }
    }
    
    // Trigger events for frameworks
    const events = ['input', 'change', 'keyup', 'paste'];
    events.forEach(eventType => {
      element.dispatchEvent(new Event(eventType, { bubbles: true }));
    });
    
    // For React and other frameworks
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set || 
                                   Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (nativeInputValueSetter && element.value !== undefined) {
      nativeInputValueSetter.call(element, element.textContent);
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  replaceInTextInput(element) {
    // For textarea and input elements
    const currentValue = element.value || '';
    
    // Method 1: Replace only the selected text within existing content
    let newValue;
    let newCursorPos;
    
    if (currentValue.includes(this.selectedText)) {
      // Replace only the first occurrence of the selected text
      const beforeSelected = currentValue.indexOf(this.selectedText);
      newValue = currentValue.replace(this.selectedText, this.optimizedPrompt);
      newCursorPos = beforeSelected + this.optimizedPrompt.length;
    } else {
      // Fallback: Try to use stored selection info or current selection
      let selectionStart, selectionEnd;
      
      if (this.targetElement === element && this.selectionStart !== null && this.selectionEnd !== null) {
        // Use stored selection info if available and matches current element
        selectionStart = this.selectionStart;
        selectionEnd = this.selectionEnd;
      } else {
        // Use current selection or fallback to replacing entire content
        selectionStart = element.selectionStart || 0;
        selectionEnd = element.selectionEnd || currentValue.length;
      }
      
      // Replace the selected range
      newValue = currentValue.substring(0, selectionStart) + 
                this.optimizedPrompt + 
                currentValue.substring(selectionEnd);
      newCursorPos = selectionStart + this.optimizedPrompt.length;
    }
    
    // Set the new value
    element.value = newValue;
    
    // Method 2: For React and modern frameworks - use native setter
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      element.constructor.prototype, 'value'
    )?.set;
    
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(element, newValue);
    }
    
    // Method 3: Focus and set cursor position after the replaced text
    element.focus();
    
    // Set cursor position after the replacement
    if (element.setSelectionRange && newCursorPos !== undefined) {
      element.setSelectionRange(newCursorPos, newCursorPos);
    }
    
    // Method 4: Trigger comprehensive events
    const events = [
      'input',
      'change', 
      'keyup',
      'paste'
    ];
    
    events.forEach(eventType => {
      element.dispatchEvent(new Event(eventType, { bubbles: true }));
    });
    
    // Method 5: Additional compatibility check
    setTimeout(() => {
      if (element.value !== newValue) {
        element.value = newValue;
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, 50);
  }

  findNearestInputField() {
    // Website-specific selectors for better targeting
    const specificSelectors = {
      // Claude.ai
      'claude.ai': [
        'div[contenteditable="true"][data-testid*="chat"]',
        'div[contenteditable="true"]',
        '.ProseMirror'
      ],
      // ChatGPT
      'chatgpt.com': [
        'textarea[data-testid="composer-text-input"]',
        '#prompt-textarea',
        'textarea[placeholder*="Message"]'
      ],
      'chat.openai.com': [
        'textarea[data-testid="composer-text-input"]',
        '#prompt-textarea',
        'textarea[placeholder*="Message"]'
      ],
      // Gemini
      'gemini.google.com': [
        'div[contenteditable="true"]',
        'textarea[aria-label*="Enter a prompt"]'
      ],
      // Perplexity
      'perplexity.ai': [
        'textarea[placeholder*="Ask anything"]',
        'div[contenteditable="true"]'
      ]
    };
    
    // Get current domain
    const domain = window.location.hostname;
    const domainKey = Object.keys(specificSelectors).find(key => domain.includes(key));
    
    // Try website-specific selectors first
    if (domainKey) {
      for (const selector of specificSelectors[domainKey]) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          if (this.isValidInputField(element)) {
            return element;
          }
        }
      }
    }
    
    // Fallback to generic selectors
    const genericSelectors = [
      'textarea[placeholder*="message" i]',
      'textarea[placeholder*="question" i]',
      'textarea[placeholder*="ask" i]',
      'textarea[placeholder*="prompt" i]',
      'textarea[placeholder*="chat" i]',
      'div[contenteditable="true"]',
      'textarea[rows]',
      'textarea',
      'input[type="text"]'
    ];
    
    for (const selector of genericSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        if (this.isValidInputField(element)) {
          return element;
        }
      }
    }
    
    return null;
  }

  isValidInputField(element) {
    // Check if element is visible and reasonable size
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    return (
      rect.width > 100 && 
      rect.height > 20 && 
      style.display !== 'none' && 
      style.visibility !== 'hidden' &&
      !element.disabled &&
      !element.readOnly
    );
  }

  isSelectionInInputField(selection) {
    // Check if the current selection is within an input field
    if (!selection || selection.rangeCount === 0) {
      return false;
    }

    try {
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      
      // Walk up the DOM tree to find if we're inside an input field
      let element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
      
      while (element && element !== document.body) {
        // Check for standard input fields
        if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
          return this.isValidInputField(element);
        }
        
        // Check for contenteditable elements
        if (element.contentEditable === 'true') {
          return this.isValidInputField(element);
        }
        
        // Check for specific AI chat platforms' input elements
        if (this.isAIChatInputElement(element)) {
          return true;
        }
        
        element = element.parentElement;
      }
      
      return false;
    } catch (error) {
      console.log('Error checking if selection is in input field:', error);
      return false;
    }
  }

  isAIChatInputElement(element) {
    // Check for specific AI chat platform input patterns
    const chatInputSelectors = [
      // Claude.ai patterns
      '[data-testid*="chat"]',
      '.ProseMirror',
      // ChatGPT patterns  
      '[data-testid="composer-text-input"]',
      '[placeholder*="Message"]',
      // Gemini patterns
      '[aria-label*="Enter a prompt"]',
      // Perplexity patterns
      '[placeholder*="Ask anything"]',
      // Generic chat patterns
      '[placeholder*="message" i]',
      '[placeholder*="question" i]',
      '[placeholder*="ask" i]',
      '[placeholder*="prompt" i]',
      '[placeholder*="chat" i]'
    ];

    // Check if element matches any chat input patterns
    for (const selector of chatInputSelectors) {
      try {
        if (element.matches && element.matches(selector)) {
          return this.isValidInputField(element);
        }
      } catch (e) {
        // Ignore selector errors
      }
    }

    // Check parent elements for chat input patterns
    let parent = element.parentElement;
    let depth = 0;
    while (parent && depth < 3) { // Only check up to 3 levels up
      for (const selector of chatInputSelectors) {
        try {
          if (parent.matches && parent.matches(selector)) {
            return this.isValidInputField(parent);
          }
        } catch (e) {
          // Ignore selector errors
        }
      }
      parent = parent.parentElement;
      depth++;
    }

    return false;
  }

  isInputFieldContentValid(selection, selectedText) {
    // Check if the input field has meaningful content beyond just the selection
    try {
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      let inputElement = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
      
      // Walk up to find the actual input element
      while (inputElement && inputElement !== document.body) {
        if (inputElement.tagName === 'TEXTAREA' || inputElement.tagName === 'INPUT') {
          const totalContent = inputElement.value || '';
          
          // If the field is completely empty, don't show popup
          if (totalContent.trim().length === 0) {
            return false;
          }
          
          // If the field only contains the selected text and nothing else, 
          // and the selected text is very short, it might be a deletion case
          if (totalContent.trim() === selectedText.trim() && selectedText.length < 10) {
            return false;
          }
          
          return true;
        }
        
        if (inputElement.contentEditable === 'true') {
          const totalContent = inputElement.textContent || inputElement.innerText || '';
          
          // If the field is completely empty, don't show popup
          if (totalContent.trim().length === 0) {
            return false;
          }
          
          // If the field only contains the selected text and nothing else,
          // and the selected text is very short, it might be a deletion case
          if (totalContent.trim() === selectedText.trim() && selectedText.length < 10) {
            return false;
          }
          
          return true;
        }
        
        inputElement = inputElement.parentElement;
      }
      
      // If we can't find a proper input element, allow the selection
      return true;
    } catch (error) {
      console.log('Error validating input field content:', error);
      return true; // Default to allowing the selection if we can't validate
    }
  }

  copyOptimizedText() {
    if (!this.optimizedPrompt) return;
    
    navigator.clipboard.writeText(this.optimizedPrompt).then(() => {
      // Text copied successfully - no visual feedback needed
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  }

  handleCloseClick() {
    if (this.isOptimizing) {
      // Show a message that operation is in progress
      const closeBtn = document.getElementById('closeOptimizer');
      const originalTitle = closeBtn.title;
      closeBtn.title = 'Please wait, optimizing in progress...';
      closeBtn.style.opacity = '0.5';
      closeBtn.style.cursor = 'not-allowed';
      
      setTimeout(() => {
        if (closeBtn) {
          closeBtn.title = originalTitle;
          closeBtn.style.opacity = '';
          closeBtn.style.cursor = '';
        }
      }, 2000);
      return;
    }
    
    // Clear selection to prevent reopening
    this.clearSelection();
    this.hidePopup();
  }

  hidePopup() {
    // Prevent popup closure during optimizing
    if (this.isOptimizing) {
      return;
    }
    
    // Remove all existing popups from DOM to prevent duplicates
    const existingPopups = document.querySelectorAll('.prompt-optimizer-popup');
    existingPopups.forEach(popup => {
      popup.remove();
    });
    
    if (this.optimizationPopup) {
      // Clean up event listeners
      this.removeRepositioningEventListeners();
      this.optimizationPopup = null;
    }
    
    // Set flag to prevent immediate reopening
    this.justClosed = true;
    setTimeout(() => {
      this.justClosed = false;
    }, 500); // 500ms cooldown period
  }

  handleMouseDown(event) {
    // Check if clicking outside the popup
    if (this.optimizationPopup && !this.optimizationPopup.contains(event.target)) {
      this.clearSelection();
      this.hidePopup();
    }
  }

  positionPopup(popup, selectionRect) {
    // Get viewport dimensions
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;
    
    // Handle invalid or off-screen selection rectangles
    if (!selectionRect || 
        selectionRect.width === 0 && selectionRect.height === 0 ||
        selectionRect.top < scrollY - 100 || 
        selectionRect.top > scrollY + viewportHeight + 100 ||
        selectionRect.left < scrollX - 100 || 
        selectionRect.left > scrollX + viewportWidth + 100) {
      
      // Use center-screen positioning for problematic selections
      selectionRect = {
        top: scrollY + viewportHeight / 3,
        left: scrollX + viewportWidth / 2 - 160,
        bottom: scrollY + viewportHeight / 3 + 20,
        right: scrollX + viewportWidth / 2 + 160,
        width: 320,
        height: 20
      };
    }
    
    // Calculate popup dimensions (we need to temporarily append it to measure)
    popup.style.position = 'absolute';
    popup.style.visibility = 'hidden';
    popup.style.top = '0px';
    popup.style.left = '0px';
    popup.style.zIndex = '10000';
    document.body.appendChild(popup);
    
    const popupRect = popup.getBoundingClientRect();
    const popupHeight = popupRect.height;
    const popupWidth = popupRect.width;
    
    // Remove from DOM temporarily
    document.body.removeChild(popup);
    popup.style.visibility = 'visible';
    
    // Calculate available space above and below the selection
    const spaceAbove = selectionRect.top;
    const spaceBelow = viewportHeight - selectionRect.bottom;
    
    // Calculate available space left and right
    const spaceLeft = selectionRect.left;
    const spaceRight = viewportWidth - selectionRect.right;
    
    // Determine vertical position
    let top;
    let preferredVerticalPosition = 'below'; // default preference
    
    // Check if popup fits below the selection
    if (spaceBelow >= popupHeight + 10) {
      // Enough space below
      top = selectionRect.bottom + scrollY + 10;
      preferredVerticalPosition = 'below';
    } else if (spaceAbove >= popupHeight + 10) {
      // Not enough space below, but enough space above
      top = selectionRect.top + scrollY - popupHeight - 10;
      preferredVerticalPosition = 'above';
    } else {
      // Not enough space in either direction, choose the larger space
      if (spaceAbove > spaceBelow) {
        // More space above
        top = Math.max(scrollY + 10, selectionRect.top + scrollY - popupHeight - 10);
        preferredVerticalPosition = 'above';
      } else {
        // More space below or equal
        top = selectionRect.bottom + scrollY + 10;
        preferredVerticalPosition = 'below';
      }
    }
    
    // Determine horizontal position
    let left = selectionRect.left + scrollX;
    
    // Check if popup fits horizontally
    if (left + popupWidth > viewportWidth + scrollX) {
      // Popup would overflow right side, try to align right edge
      left = selectionRect.right + scrollX - popupWidth;
      
      // If it still overflows left side, align to left edge of viewport
      if (left < scrollX) {
        left = scrollX + 10;
      }
    }
    
    // Ensure popup doesn't overflow left side
    if (left < scrollX) {
      left = scrollX + 10;
    }
    
    // Ensure popup doesn't overflow top or bottom of viewport
    if (top < scrollY) {
      top = scrollY + 10;
    } else if (top + popupHeight > scrollY + viewportHeight) {
      top = scrollY + viewportHeight - popupHeight - 10;
    }
    
    // Apply positioning
    popup.style.position = 'absolute';
    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;
    popup.style.zIndex = '10000';
    
    // Add a class to indicate position for potential styling
    popup.classList.add(`positioned-${preferredVerticalPosition}`);
    
    // Store positioning info for later repositioning
    popup._positionInfo = {
      selectionRect,
      preferredVerticalPosition,
      originalTop: top,
      originalLeft: left
    };
  }

  repositionPopupAfterExpansion() {
    if (!this.optimizationPopup || !this.optimizationPopup._positionInfo) {
      return;
    }

    const popup = this.optimizationPopup;
    const { selectionRect, preferredVerticalPosition } = popup._positionInfo;
    
    // Get viewport dimensions
    const viewportHeight = window.innerHeight;
    const scrollY = window.scrollY;
    
    // Get current popup dimensions (now with expanded content)
    const popupRect = popup.getBoundingClientRect();
    const popupHeight = popupRect.height;
    
    let newTop = parseInt(popup.style.top);
    let repositioned = false;
    let newPosition = preferredVerticalPosition;
    
    // Calculate available space above and below selection
    const spaceAbove = selectionRect.top - scrollY;
    const spaceBelow = (scrollY + viewportHeight) - selectionRect.bottom;
    
    // Check if popup now overflows the bottom of the viewport
    if (newTop + popupHeight > scrollY + viewportHeight - 10) {
      if (preferredVerticalPosition === 'below') {
        // Currently positioned below, check if we should flip to above
        if (spaceAbove >= popupHeight + 20 && spaceAbove > spaceBelow) {
          // Flip to above - there's more space there
          newTop = selectionRect.top + scrollY - popupHeight - 10;
          newPosition = 'above';
          repositioned = true;
          
          // Update visual indicator
          popup.classList.remove('positioned-below');
          popup.classList.add('positioned-above');
        } else {
          // Not enough space above either, just shift up to fit in viewport
          newTop = scrollY + viewportHeight - popupHeight - 10;
          repositioned = true;
        }
      } else {
        // Already positioned above but still overflowing, shift up more
        newTop = Math.max(scrollY + 10, scrollY + viewportHeight - popupHeight - 10);
        repositioned = true;
      }
    }
    
    // Check if popup overflows the top of viewport (when positioned above)
    if (newTop < scrollY + 10) {
      if (preferredVerticalPosition === 'above' || newPosition === 'above') {
        // Try to flip to below if there's more space there
        if (spaceBelow >= popupHeight + 20 && spaceBelow > spaceAbove) {
          newTop = selectionRect.bottom + scrollY + 10;
          newPosition = 'below';
          repositioned = true;
          
          // Update visual indicator
          popup.classList.remove('positioned-above');
          popup.classList.add('positioned-below');
        } else {
          // Keep above but adjust to minimum top position
          newTop = scrollY + 10;
          repositioned = true;
        }
      } else {
        newTop = scrollY + 10;
        repositioned = true;
      }
    }
    
    // Apply new position with smooth transition
    if (repositioned) {
      popup.style.transition = 'top 0.3s ease-out';
      popup.style.top = `${newTop}px`;
      
      // Update stored position info
      popup._positionInfo.preferredVerticalPosition = newPosition;
      
      // Remove transition after animation completes
      setTimeout(() => {
        if (popup && popup.style) {
          popup.style.transition = '';
        }
      }, 300);
    }
  }

  addRepositioningEventListeners() {
    // Throttle function to limit how often repositioning occurs
    let repositionTimeout;
    const throttledReposition = () => {
      clearTimeout(repositionTimeout);
      repositionTimeout = setTimeout(() => {
        this.repositionPopupAfterExpansion();
      }, 100);
    };

    // Handle window resize
    this.resizeHandler = throttledReposition;
    window.addEventListener('resize', this.resizeHandler);

    // Handle scroll (with more aggressive throttling)
    let scrollTimeout;
    this.scrollHandler = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.repositionPopupAfterExpansion();
      }, 50);
    };
    window.addEventListener('scroll', this.scrollHandler, { passive: true });
  }

  removeRepositioningEventListeners() {
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
      this.scrollHandler = null;
    }
  }

  clearSelection() {
    // Clear text selection to prevent popup from reopening
    try {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        selection.removeAllRanges();
      }
    } catch (e) {
      // Ignore errors if selection clearing fails
    }
  }

  async restoreOptimizationState() {
    try {
      // Check if there's a current optimization for this page
      const result = await chrome.storage.local.get(['currentOptimization']);
      
      if (!result.currentOptimization) {
        return;
      }
      
      // Get the optimization data
      const optimizationResult = await chrome.storage.local.get([result.currentOptimization]);
      const optimizationData = optimizationResult[result.currentOptimization];
      
      if (!optimizationData) {
        return;
      }
      
      // Check if the optimization is for the current page and is recent (within 1 hour)
      const isCurrentPage = optimizationData.url === window.location.href;
      const isRecent = (Date.now() - optimizationData.timestamp) < 3600000; // 1 hour
      
      if (isCurrentPage && isRecent) {
        // Restore the optimization state
        this.optimizedPrompt = optimizationData.optimizedText;
        this.selectedText = optimizationData.originalText;
        this.currentSessionKey = optimizationData.sessionKey;
        
        console.log('Instant Prompt Optimizer: Restored optimization state for current page');
      }
    } catch (error) {
      console.log('Instant Prompt Optimizer: Could not restore optimization state:', error);
    }
  }

  async cleanupOldOptimizations() {
    try {
      // Get all stored optimization data
      const allData = await chrome.storage.local.get(null);
      const keysToRemove = [];
      const oneHourAgo = Date.now() - 3600000; // 1 hour
      
      for (const [key, value] of Object.entries(allData)) {
        // Check if this is an optimization key and if it's old
        if (key.startsWith('optimization_') && value.timestamp && value.timestamp < oneHourAgo) {
          keysToRemove.push(key);
        }
      }
      
      // Remove old optimization data
      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
        console.log(`Instant Prompt Optimizer: Cleaned up ${keysToRemove.length} old optimization(s)`);
      }
    } catch (error) {
      console.log('Instant Prompt Optimizer: Could not cleanup old optimizations:', error);
    }
  }

  async checkForCachedOptimization() {
    try {
      // Check if we have a cached optimization and if it matches the currently selected text
      if (this.optimizedPrompt && this.selectedText) {
        // Compare the cached original text with the currently selected text
        const currentSelection = window.getSelection().toString().trim();
        
        // Only show cached result if it exactly matches the current selection
        if (currentSelection === this.selectedText) {
          // We have a matching cached optimization, show it
          const optimizedTextDiv = document.getElementById('optimizedText');
          const optimizeBtn = document.getElementById('optimizeBtn');
          
          if (optimizedTextDiv && optimizeBtn) {
            // Display the cached optimization
            optimizedTextDiv.textContent = this.optimizedPrompt;
            optimizedTextDiv.style.display = 'block';
            
            // Hide the optimize button and show action buttons
            optimizeBtn.style.display = 'none';
            document.getElementById('replaceBtn').style.display = 'inline-flex';
            document.getElementById('copyBtn').style.display = 'inline-flex';
            
            // Reposition popup after content is added
            setTimeout(() => {
              this.repositionPopupAfterExpansion();
            }, 50);
            
            console.log('Instant Prompt Optimizer: Restored cached optimization result for matching text');
          }
        } else {
          // Current selection doesn't match cached text, clear the cache
          console.log('Instant Prompt Optimizer: Current selection differs from cached text, clearing cache');
          this.clearCachedOptimization();
        }
      }
    } catch (error) {
      console.log('Instant Prompt Optimizer: Error checking cached optimization:', error);
    }
  }

  async clearStoredOptimization() {
    try {
      if (this.currentSessionKey) {
        // Remove the specific optimization data
        await chrome.storage.local.remove([this.currentSessionKey, 'currentOptimization']);
        
        // Clear the local state
        this.optimizedPrompt = null;
        this.currentSessionKey = null;
        
        console.log('Instant Prompt Optimizer: Cleared stored optimization');
      }
    } catch (error) {
      console.log('Instant Prompt Optimizer: Error clearing stored optimization:', error);
    }
  }

  clearCachedOptimization() {
    // Clear only the local cached state, but keep stored data for potential restoration
    this.optimizedPrompt = null;
    this.selectedText = null;
    this.currentSessionKey = null;
    console.log('Instant Prompt Optimizer: Cleared local cached optimization');
  }
}

// Initialize the prompt optimizer when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.promptOptimizerInstance) {
      console.log('Instant Prompt Optimizer: Initializing on DOMContentLoaded');
      window.promptOptimizerInstance = new PromptOptimizer();
      window.promptOptimizerInjected = true;
    } else {
      console.log('Instant Prompt Optimizer: Instance already exists, skipping initialization');
    }
  });
} else {
  if (!window.promptOptimizerInstance) {
    console.log('Instant Prompt Optimizer: Initializing immediately');
    window.promptOptimizerInstance = new PromptOptimizer();
    window.promptOptimizerInjected = true;
  } else {
    console.log('Instant Prompt Optimizer: Instance already exists, skipping initialization');
  }
}