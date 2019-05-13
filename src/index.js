const postcss = require("postcss");
const flattenDeep = require("lodash/flattenDeep");

const fetchAsText = url => new Promise(resolve => {
  const xhr = new XMLHttpRequest();
  xhr.open("GET", url);
  xhr.onload = () => resolve(xhr.status < 300 ? xhr.responseText : "");
  xhr.onerror = () => resolve("");
  xhr.send();
});

// is there a more efficient, built-in way to traverse the postcss AST?
const findFontFamilies = ({ prop, value, nodes = [] }) => {
  if (prop === "font-family") return [value];
  return nodes.map(findFontFamilies);
};

const parseCSS = css => {
  // skipping a warning...
  const from = undefined;
  return postcss().process(css, { from });
};

const readFromCrossDomainSheet = ({ href }) =>
  fetchAsText(href)
    .then(parseCSS)
    .then(res => findFontFamilies(res.root))
    .then(flattenDeep)
    .then(fams => console.log(href, fams.filter(Boolean)));

const readFromSameDomainSheet = sheet => {
  for(rule of sheet.rules) {
    const { fontFamily = "" } = rule.style || {};

    if (fontFamily.length > 0)
      console.log("INTERNAL", fontFamily);
  }
};

console.log("experiment is a GO!", window.location.href);

for(sheet of document.styleSheets) {
  if (sheet.href)
    readFromCrossDomainSheet(sheet);
  else
    readFromSameDomainSheet(sheet);
};
