/*DOM Elements*/
const loadOnStartCheckbox = document.querySelector("#loadOnStart");
const textSelectionCheckbox = document.querySelector("#textSelection");
const scrollbarCheckbox = document.querySelector("#scrollbar");
const root = document.querySelector(':root');
/*Set color of options menu based on theme*/
function setCss(chosenTheme) {
  if (!chosenTheme) return;
  const {colors} = chosenTheme.definition;
  root.style.setProperty('--checkbox-color',colors.accentColor);
  root.style.setProperty('--foreground-color',colors.foregroundColor);
  root.style.setProperty('--checkbox-border-color',colors.baseIconColor);
  root.style.setProperty('--header-color',colors.headerColor);
  root.style.setProperty('--checkmark-color',colors.classNameColor);
}

function initContent() {
  browser.storage.local.get(['loadOnStart', 'textSelection', 'scrollbar', 'waifuThemes', 'currentThemeId'])
    .then((storage) => {
      initCheckbox(loadOnStartCheckbox,!!storage.loadOnStart);
      initCheckbox(textSelectionCheckbox,!!storage.textSelection);
      initCheckbox(scrollbarCheckbox,!!storage.scrollbar);
      setCss(storage.waifuThemes.themes[storage.currentThemeId])
    });
}

const onChangeCheckEvents = async (e) => {
  changeCheckboxState(e);
  await browser.runtime.sendMessage({
    optionName: e.target.id,
    optionValue: e.target.className
  });
};
/*Initialize checkbox state*/
function initCheckbox(el,state){
  el.className = state ? 'checked': '';
}
/*Changes checkbox state*/
function changeCheckboxState(e){
  const el = e.target;
  el.className = el.className !== 'checked' ? "checked":'';
}

initContent();
loadOnStartCheckbox.addEventListener('click', onChangeCheckEvents, true);
textSelectionCheckbox.addEventListener('click', onChangeCheckEvents, true);
scrollbarCheckbox.addEventListener('click', onChangeCheckEvents, true);
