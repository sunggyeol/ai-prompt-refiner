// AI Prompt Refiner Content Script - Gemini Cloud API Version
class PromptRefiner {
  constructor() {
    this.selectedText = '';
    this.selectionRange = null;
    this.refinementPopup = null;
    this.apiKey = null;
    this.isRefining = false; // Track if a refining request is in progress
    this.justClosed = false; // Track if popup was just closed to prevent immediate reopening
    
    this.init();
  }

  async init() {
    // Load API key from storage
    try {
      const result = await chrome.storage.sync.get(['geminiApiKey']);
      this.apiKey = result.geminiApiKey;
      
      if (!this.apiKey) {
        console.warn('AI Prompt Refiner: No Gemini API key found. Please configure in extension popup.');
      }
    } catch (error) {
      console.error('AI Prompt Refiner: Error loading API key:', error);
    }

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
  }

  handleTextSelection(event) {
    // Prevent handling new selections during active refinement
    if (this.isRefining) {
      return;
    }
    
    // Prevent reopening immediately after closing
    if (this.justClosed) {
      return;
    }
    
    // Small delay to ensure selection is complete
    setTimeout(() => {
      // Double-check refinement state and close state after timeout
      if (this.isRefining || this.justClosed) {
        return;
      }
      
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();
      
      if (selectedText.length > 0 && selectedText.length < 8000) {
        this.selectedText = selectedText;
        this.selectionRange = selection.getRangeAt(0).cloneRange(); // Clone to preserve
        
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
        
        this.showRefinementOptions(event);
      } else {
        this.hidePopup();
      }
    }, 10);
  }

  showRefinementOptions(event) {
    // Prevent creating new popups during active refinement
    if (this.isRefining) {
      return;
    }
    
    this.hidePopup(); // Remove any existing popup
    
    const rect = this.selectionRange.getBoundingClientRect();
    
    this.refinementPopup = document.createElement('div');
    this.refinementPopup.className = 'prompt-refiner-popup';
    this.refinementPopup.innerHTML = `
      <div class="prompt-refiner-content">
        <div class="prompt-refiner-header">
          <span class="prompt-refiner-title">
            <svg class="header-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10,9 9,9 8,9"/>
            </svg>
            Grammar & Clarity
          </span>
          <button class="prompt-refiner-close" id="closeRefiner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="prompt-refiner-info">
          <small>Selected: ${this.selectedText.length} characters${this.selectedText.length > 4000 ? ' (large text)' : ''}</small>
        </div>
        <div class="prompt-refiner-buttons">
          <button id="refineBtn" class="prompt-refiner-btn primary">
            <svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Fix Grammar & Clarity${this.selectedText.length > 4000 ? ' (may take longer)' : ''}
          </button>
          <button id="replaceBtn" class="prompt-refiner-btn secondary" style="display: none;">
            <svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20,6 9,17 4,12"/>
            </svg>
            Replace Text
          </button>
          <button id="copyBtn" class="prompt-refiner-btn secondary" style="display: none;">
            <svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copy Refined
          </button>
        </div>
        <div id="refinedText" class="prompt-refiner-result" style="display: none;"></div>
        <div id="loadingIndicator" class="prompt-refiner-loading" style="display: none;">
          <div class="spinner"></div>
          <span id="loadingMessage">Refining your prompt...</span>
        </div>
        ${!this.apiKey ? '<div class="prompt-refiner-error">⚠️ Please configure Gemini API key in extension popup</div>' : ''}
      </div>
    `;
    
    // Position the popup intelligently
    this.positionPopup(this.refinementPopup, rect);
    
    document.body.appendChild(this.refinementPopup);
    
    // Add event listeners
    document.getElementById('refineBtn').addEventListener('click', this.refinePrompt.bind(this));
    document.getElementById('replaceBtn').addEventListener('click', this.replaceText.bind(this));
    document.getElementById('copyBtn').addEventListener('click', this.copyRefinedText.bind(this));
    document.getElementById('closeRefiner').addEventListener('click', this.handleCloseClick.bind(this));
    
    // Prevent popup from closing when clicking inside it
    this.refinementPopup.addEventListener('mousedown', (e) => e.stopPropagation());
    
    // Add window event listeners for responsive repositioning
    this.addRepositioningEventListeners();
  }

  async refinePrompt() {
    // Prevent multiple simultaneous requests
    if (this.isRefining) {
      return;
    }

    if (!this.apiKey) {
      alert('Please configure your Gemini API key in the extension popup first.');
      return;
    }

    const loadingIndicator = document.getElementById('loadingIndicator');
    const refineBtn = document.getElementById('refineBtn');
    const refinedTextDiv = document.getElementById('refinedText');
    
    // Set refining state to prevent multiple requests
    this.isRefining = true;
    
    // Show loading state with appropriate message
    const isLargeText = this.selectedText.length > 2000;
    const loadingMessage = document.getElementById('loadingMessage');
    loadingMessage.textContent = isLargeText ? 
      'Refining large text, this may take a moment...' : 
      'Refining your prompt...';
    
    loadingIndicator.style.display = 'flex';
    refineBtn.disabled = true;
    refineBtn.classList.add('loading');
    refineBtn.innerHTML = `
      <svg class="btn-icon spinner-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12a9 9 0 11-6.219-8.56"/>
      </svg>
      <span>Refining...</span>
    `;
    
    // Disable other buttons during loading
    const replaceBtn = document.getElementById('replaceBtn');
    const copyBtn = document.getElementById('copyBtn');
    if (replaceBtn) replaceBtn.disabled = true;
    if (copyBtn) copyBtn.disabled = true;
    
    try {
      const refinedPrompt = await this.callGeminiAPI(this.selectedText);
      
      // Display the refined prompt
      refinedTextDiv.textContent = refinedPrompt;
      refinedTextDiv.style.display = 'block';
      
      // Show action buttons
      document.getElementById('replaceBtn').style.display = 'inline-flex';
      document.getElementById('copyBtn').style.display = 'inline-flex';
      
      this.refinedPrompt = refinedPrompt;
      
      // Reposition popup after content is added to prevent overflow
      setTimeout(() => {
        this.repositionPopupAfterExpansion();
      }, 50);
      
    } catch (error) {
      console.error('AI Prompt Refiner: Error refining prompt:', error);
      
      let errorMessage = 'Error refining prompt. ';
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
      // Reset refining state
      this.isRefining = false;
      
      // Hide loading state
      loadingIndicator.style.display = 'none';
      refineBtn.disabled = false;
      refineBtn.classList.remove('loading');
      refineBtn.innerHTML = `
        <svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        Fix Grammar & Clarity
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
    
    // Create a more efficient prompt based on text length
    const isLargeText = text.length > 2000;
    
    const prompt = isLargeText ? 
      `As a grammar and clarity expert, refine this text focusing exclusively on:
- Correcting grammar, spelling, and punctuation errors
- Improving sentence structure and readability
- Using clear, precise language
- Maintaining the exact original meaning and intent

Text to refine:
"${text}"

Return only the grammatically corrected and clarified version:` :
      `You are a grammar and language clarity expert. Your task is to refine the following text by focusing ONLY on:

1. Fixing grammar, spelling, and punctuation errors
2. Improving sentence structure for better readability
3. Using clearer, more precise language
4. Maintaining the exact original meaning and intent

Do NOT:
- Add new content or requirements
- Change the core message or intent
- Make it more specific or actionable beyond clarity improvements
- Add context that wasn't originally there

Please refine this text: "${text}"

Respond with only the refined text, nothing else.`;

    // Adjust parameters based on text length
    const maxTokens = isLargeText ? 2048 : 1024;
    
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

    // Add timeout for large text processing
    const timeoutMs = isLargeText ? 30000 : 15000; // 30s for large text, 15s for normal
    
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
    if (!this.refinedPrompt) return;
    
    // Find the nearest input field or textarea
    const inputField = this.findNearestInputField();
    
    if (inputField) {
      console.log('AI Prompt Refiner: Found input field:', inputField.tagName, inputField);
      
      // Handle different types of input elements
      if (inputField.contentEditable === 'true') {
        console.log('AI Prompt Refiner: Replacing in contenteditable element');
        this.replaceInContentEditable(inputField);
      } else if (inputField.tagName === 'TEXTAREA' || inputField.tagName === 'INPUT') {
        console.log('AI Prompt Refiner: Replacing in textarea/input element');
        this.replaceInTextInput(inputField);
      } else {
        console.log('AI Prompt Refiner: Unknown input type, copying to clipboard');
        this.copyRefinedText();
        return;
      }
      
      this.hidePopup();
    } else {
      console.log('AI Prompt Refiner: No input field found, copying to clipboard');
      this.copyRefinedText();
    }
  }


  replaceInContentEditable(element) {
    // For contenteditable elements (like Claude.ai)
    const currentText = element.textContent || element.innerText || '';
    
    // Method 1: Try to replace only the selected text within existing content
    if (currentText.includes(this.selectedText)) {
      // Replace only the first occurrence of the selected text
      const newText = currentText.replace(this.selectedText, this.refinedPrompt);
      element.textContent = newText;
      
      // Calculate cursor position after replacement
      const beforeSelected = currentText.indexOf(this.selectedText);
      const newCursorPos = beforeSelected + this.refinedPrompt.length;
      
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
          document.execCommand('insertText', false, this.refinedPrompt);
        } catch (e) {
          // Final fallback: replace entire content
          element.textContent = this.refinedPrompt;
        }
      } else {
        // Final fallback: replace entire content
        element.textContent = this.refinedPrompt;
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
      newValue = currentValue.replace(this.selectedText, this.refinedPrompt);
      newCursorPos = beforeSelected + this.refinedPrompt.length;
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
                this.refinedPrompt + 
                currentValue.substring(selectionEnd);
      newCursorPos = selectionStart + this.refinedPrompt.length;
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

  copyRefinedText() {
    if (!this.refinedPrompt) return;
    
    navigator.clipboard.writeText(this.refinedPrompt).then(() => {
      // Text copied successfully - no visual feedback needed
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  }

  handleCloseClick() {
    if (this.isRefining) {
      // Show a message that operation is in progress
      const closeBtn = document.getElementById('closeRefiner');
      const originalTitle = closeBtn.title;
      closeBtn.title = 'Please wait, refining in progress...';
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
    // Prevent popup closure during refining
    if (this.isRefining) {
      return;
    }
    
    if (this.refinementPopup) {
      // Clean up event listeners
      this.removeRepositioningEventListeners();
      
      this.refinementPopup.remove();
      this.refinementPopup = null;
    }
    
    // Set flag to prevent immediate reopening
    this.justClosed = true;
    setTimeout(() => {
      this.justClosed = false;
    }, 500); // 500ms cooldown period
  }

  handleMouseDown(event) {
    // Check if clicking outside the popup
    if (this.refinementPopup && !this.refinementPopup.contains(event.target)) {
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
    if (!this.refinementPopup || !this.refinementPopup._positionInfo) {
      return;
    }

    const popup = this.refinementPopup;
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
}

// Initialize the prompt refiner when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new PromptRefiner());
} else {
  new PromptRefiner();
}