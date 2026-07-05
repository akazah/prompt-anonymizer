const MENU_ID = "prompt-anonymizer-selection";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Anonymize selection",
    contexts: ["selection"],
  });
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !info.selectionText) return;
  void chrome.storage.session.set({ pendingText: info.selectionText });
  if (tab?.id != null) {
    void chrome.sidePanel.open({ tabId: tab.id });
  }
});
