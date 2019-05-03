// Recursive

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.set({
        "fontActivated": true
    });
});

chrome.tabs.onUpdated.addListener((tabId, { status }, { active }) => {
    if (active && status === "loading") {
        chrome.storage.sync.get(
            "fontActivated", ({ fontActivated }) => {
                toggle(fontActivated);
            }
        );
    }
});

function toggle(fontActivated) {
    // The value "#" results in an invalid `font-family` rule,
    // restoring the site's original `font-family` rule.
    // Toggling CSS variables is faster than addding/removing classes!
    const swapAction = fontActivated ? "hankypankyschnitzelhosen" : "*";
    // const swapAction = fontActivated ? "add" : "remove";
    console.log(swapAction);

    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, tabs => {
        // TODO: Inject only once per page
        // It's only injected again when toggling the extension
        // on and off, and doesn't really fudge anyting up, so
        // I guess this is low prio.
        chrome.tabs.insertCSS(tabs[0].id, {
            file: "css/apply.css",
            runAt: "document_start"
        });


        // Swapping classes is really slow. So let's use
        // a CSS variable
        // TODO: how to unset CSS variable so it doesn't
        // overwrite the site's font-family?
        // chrome.tabs.executeScript(
        //     tabs[0].id, {
        //         // code: `document.body.classList.${swapAction}("hankypankyschnitzelhosen-disabled");`,
        //         code: `document.documentElement.style.setProperty("--hanky", '${swapAction}');`,
        //         runAt: "document_start"
        //     });





        // TODO: upon turning the font back on again, it's requested
        // and returns a 200 after ~ 60ms. Why can't it be cached or
        // served quicker?
    });
}