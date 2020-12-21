/// Local Storage to hold global variables
const themes = new WaifuThemes();

function initStorage() {
  const storage = {
    currentThemeId: "",
    previousThemeId: "",
    themes: new WaifuThemes()
  };
  browser.storage.local.set(storage);
}

/*Sets the browser theme*/
function setTheme(json) {
  fetch(json)
    .then((res) => {
      return res.json();
    })
    .then((theme) => {
      browser.theme.update(theme);
    });
}

/*Creates the 'Waifu Tab Page'*/
function setPage(tabID, page) {
  browser.tabs.update(
    tabID,
    {
      active: true,
      loadReplace: true,
      url: page
    }
  );
}

/*Begins creation of the custom themed 'Waifu Tab Page'*/
function themePageSetup(tabID, page, json, setNewTab) {
  if (setNewTab) {
    setPage(tabID, page);
  }
  setTheme(json);
}

/*Activates a theme based on the chosen themeId.*/
function activateTheme(tabID, setNewTab = true) {
  browser.storage.local.get()
    .then((storage) => {
      if (themes.exists(storage.currentThemeId)) {
        themePageSetup(tabID, themes.getPage(storage.currentThemeId), themes.getJSON(storage.currentThemeId), setNewTab);
      } else {
        browser.theme.reset();
      }
    });

}

/*Replaces the original 'New Tab' pages with a custom themed one (Waifu Tab)*/
function newTabPage(tab) {
  const pagesToEffect = tab.url.includes("about:privatebrowsing")
    || tab.url.includes("about:home")
    || tab.url.includes("about:newtab");
  if (pagesToEffect) {
    activateTheme(tab.id);
  }
}

/*Update theme immediately after selecting a themeId*/
function liveUpdateTheme() {
  browser.tabs.query({active: true})
    .then((tabs) => {
      browser.storage.local.get()
        .then((storage) => {
          activateTheme(tabs[0].id, false);
          browser.storage.local.set({previousThemeId: storage.currentThemeId});
        });
    });
}

/*Replace all Firefox's New Tabs with a Waifu Tab*/
function setThemeForAllNewTabs() {
  browser.tabs.query({})
    .then((tabs) => {
      const newTabs = tabs.filter(tab =>
        tab.url.includes("about:privatebrowsing")
        || tab.url.includes("about:home")
        || tab.url.includes("about:newtab")
        || tab.url.includes(browser.runtime.getURL("themeIds"))
      );
      browser.storage.local.get()
        .then((storage) => {
          if (newTabs.length > 0 && themes.exists(storage.currentThemeId)) {
            // Update each new tab with the Waifu Tab
            for (let tab of newTabs) {
              browser.tabs.update(tab.id, {
                loadReplace: true,
                url: themes.getPage(storage.currentThemeId)
              });
            }
          } else if (!themes.exists(storage.currentThemeId)) {
            //Close all New Tabs
            for (let tab of newTabs) {
              browser.tabs.remove(tab.id);
            }
          }
        });

    });
}

/*Receives the chosen theme from the popup menu.
* Set the theme based on the chosen themeId.*/
function themeInstallationListener(msg) {
  browser.storage.local.get()
    .then((storage) => {
      browser.storage.local.set({currentThemeId: msg.themeId});
      browser.storage.local.get()
        .then((storage) => {
          if (storage.previousThemeId !== storage.currentThemeId) {
            liveUpdateTheme();
            setThemeForAllNewTabs();
          }
        });
    });
}

initStorage();
/*---Event Listeners---*/
browser.runtime.onMessage.addListener(themeInstallationListener);
browser.tabs.onCreated.addListener(newTabPage);
