<p align="center">
    <img alt="type-x icon" src="design/branding/toolbar-icons/typex-active@128.png" width="64" />
</p>
<h1 align="center">
  Type-X: test your fonts across the web!
</h1>

Type-X is a Chrome Extension that makes it easy and efficient to test local fonts on any website.

- Browse comfortably to experience your own fonts in context, with blazing-fast font injection and a one-click override.
- Use your local fonts or add custom font files directly to test real web font files – WOFF & WOFF2 included (all fonts stay on your computer).
- Take full control over how you apply your fonts with custom CSS selectors and styles.
- Avoid "tofu" from icon fonts with preset and custom selectors to ignore icon elements.

![Type-X in use to apply font overrides to Wikipedia](design/typex-demo.gif)

## Why? 

Type designers spend countless hours creating type proofs and fake designs to test their fonts. This is a vital part of the type design process, but sometimes the best way to understand how a font works (and what needs fixing) is to experience it as a reader, not as a designer.

Likewise, web designers & developers spend a lot of time guessing what different fonts might look like in their apps, but testing actual fonts in context requires someone to either dig into the CSS or to mess with clunky CSS-override browser extensions.

Additionally, almost *anyone* may have reasons they want to easily override fonts on the web. Maybe they are trying out a new typeface and want to get an idea of what it feels like to look at, read, and use. Maybe they just prefer to browse the news in a particular font.

Whatever reason you want to override fonts, Type-X makes it fast, easy, and fun. Just visit any webpage, then hit a button to swap fonts! Open the extension’s settings panel to try different fonts from your collection, just like you would in a desktop app. Need to tweak the styles to make it work just-so? Customize the selectors you target and the CSS styles you apply, all within the extension.

## Installation

Find the Type-X extension in the [Chrome web store](https://chrome.google.com/webstore/category/extensions). (A direct link will be added once it's released.)

Alternatively, you can clone this repo and use it in Chrome:

1. Git Clone the repo
2. Go to chrome://extensions/ in Chrome
3. Turn on "Developer Mode"
4. Click "Load unpacked"
5. Navigate to the folder of the repo you cloned

## Contributing

Have you found selectors of icon fonts that might be worth adding to the preset "ignore" list?  

Did you get stuck on something?

Have you found a bug?

Let us know! [File an issue](https://github.com/kabisa/recursive-extension/issues) or make a pull request (please see [Contributing guidelines](CONTRIBUTING.md)).
