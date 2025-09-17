// Background script for Instant Prompt Optimizer
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateCustomWebsites') {
    // Store custom websites for later use
    chrome.storage.sync.set({ customWebsites: request.websites });
    sendResponse({ success: true });
  }
  return true;
});

// Inject content script into tabs when they are activated or updated
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await checkAndInjectContentScript(activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    await checkAndInjectContentScript(tabId);
  }
});

async function checkAndInjectContentScript(tabId) {
  try {
    // Get current tab info
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('moz-extension://') || tab.url.startsWith('edge://')) {
      return;
    }
    
    const url = new URL(tab.url);
    const hostname = url.hostname;
    
    // Skip obvious non-content pages
    const skipPatterns = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '.local'
    ];
    
    // More generous approach: inject on most websites, only skip specific patterns
    let shouldInject = true;
    
    // Skip if it matches skip patterns
    for (const pattern of skipPatterns) {
      if (hostname.includes(pattern)) {
        shouldInject = false;
        break;
      }
    }
    
    // Also check if user has specifically added this to custom websites
    if (shouldInject) {
      const result = await chrome.storage.sync.get(['customWebsites']);
      const customWebsites = result.customWebsites || [];
      
      // If custom websites are configured, give them priority
      if (customWebsites.length > 0) {
        const isCustomSite = customWebsites.some(site => {
          return hostname.includes(site.url) || site.url.includes(hostname);
        });
        
        // Still include default popular sites even if custom sites are configured
        const defaultSites = [
          'claude.ai', 'perplexity.ai', 'chatgpt.com', 'chat.openai.com',
          'gemini.google.com', 'grok.com', 'google.com', 'bing.com',
          'duckduckgo.com', 'github.com', 'stackoverflow.com', 'reddit.com'
        ];
        
        const isDefaultSite = defaultSites.some(site => hostname.includes(site));
        
        shouldInject = isCustomSite || isDefaultSite;
      }
    }
    
    if (shouldInject) {
      // Check if content script is already injected
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => window.promptOptimizerInjected
        });
        
        if (!results[0]?.result) {
          // Inject content script and CSS
          await chrome.scripting.executeScript({
            target: { tabId },
            files: ['content.js']
          });
          
          await chrome.scripting.insertCSS({
            target: { tabId },
            files: ['styles.css']
          });
          
          // Mark as injected
          await chrome.scripting.executeScript({
            target: { tabId },
            func: () => { window.promptOptimizerInjected = true; }
          });
        }
      } catch (error) {
        console.log('Could not inject content script:', error);
      }
    }
  } catch (error) {
    console.log('Error in checkAndInjectContentScript:', error);
  }
}

// Handle extension install/startup
chrome.runtime.onStartup.addListener(() => {
  // Initialize any necessary setup
});

chrome.runtime.onInstalled.addListener(() => {
  // Initialize default settings if needed
});
