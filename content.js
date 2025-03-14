chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.extractedNumbers) {
        let checkboxes = document.querySelectorAll("input[type='checkbox']");
        
        if (checkboxes.length === 0) {
            alert("No checkboxes found on this page.");
            return;
        }

        let found = false;
        checkboxes.forEach(checkbox => {
            let checkboxName = checkbox.name;
            message.extractedNumbers.forEach(num => {
                let extractedNum = num.toUpperCase();
                if (checkboxName.endsWith(extractedNum)) {
                    checkbox.checked = true;
                    found = true;
                }
            });
        });

        if (!found) {
            alert("No matching checkboxes found.");
        }
    }
});
