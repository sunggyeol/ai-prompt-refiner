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
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      return;
    }
    
    const url = new URL(tab.url);
    const hostname = url.hostname;
    
    // Check if this is a supported default site
    const defaultSites = [
      'claude.ai',
      'perplexity.ai', 
      'chatgpt.com',
      'chat.openai.com',
      'gemini.google.com',
      'grok.com'
    ];
    
    let shouldInject = defaultSites.some(site => hostname.includes(site));
    
    // Check custom websites if not a default site
    if (!shouldInject) {
      const result = await chrome.storage.sync.get(['customWebsites']);
      const customWebsites = result.customWebsites || [];
      
      shouldInject = customWebsites.some(site => {
        return hostname.includes(site.url) || site.url.includes(hostname);
      });
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
