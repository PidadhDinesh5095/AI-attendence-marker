const GEMINI_API_KEY = "USE_YOUR_API_KEY";

const branchSectionData = {
    "CSE": { "1": "01-60", "2": "01-98,A-C", "3": "C-L,01-98", "4": "I-O,01-98" },
    "EEE": { "1": "01-99" },
    "CE": { "1": "01-21" },
    "ECE": { "1": "01-64", "2": "01-98,A-C", "3": "O1-98,C-I" },
    "CSM": { "1": "01-60", "2": "01-98,A-C", "3": "C-L,01-98"},
    "CSD": { "1": "U1-U9", "2": "01-98,A-C", "3": "C-L,01-98" },
    "CSC": { "1": "01-60", "2": "01-98,A-C"},
    "CSB": { "1": "01-60" },
    "IT":{ "1": "01-64", "2": "01-98,A-C"},
    "ME":{"1":"01-14"},
    
};

document.getElementById("extractBtn").addEventListener("click", async () => {
    const fileInput = document.getElementById("imageInput");
    if (fileInput.files.length === 0) return alert("Please select an image.");

    document.getElementById("loading").classList.remove("hidden");

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async () => {
        try {
            const base64Image = reader.result.split(",")[1];

            const branch = document.getElementById("branch").value;
            const section = document.getElementById("section").value;
            let range = "";

            if (branch && section && branchSectionData[branch] && branchSectionData[branch][section]) {
                range = ` - ${branchSectionData[branch][section]}`;
            }

            const extractedNumbers = await extractNumbersWithGemini(base64Image, range);

            document.getElementById("numbersList").innerHTML = "";
            document.getElementById("markedNumbers").innerHTML = "";
            document.getElementById("notFoundNumbers").innerHTML = "";

            if (extractedNumbers.length === 0) {
                alert("No valid numbers detected.");
            } else {
                extractedNumbers.forEach(num => updateNumbersList(num));
            }
        } catch (error) {
            alert("Error processing image.");
            console.error("Gemini API error:", error);
        } finally {
            document.getElementById("loading").classList.add("hidden");
        }
    };

    reader.readAsDataURL(file);
});

async function extractNumbersWithGemini(base64Image, range) {
    try {
        const promptText = `Extract only two-character values that are either purely numeric (e.g., 77, 09) or alphanumeric (e.g., L4, i7, m2). Do not include extra characters, symbols, or words. Extract only values within the range:${range} If any extracted value is in lowercase, convert it to uppercase in the output. Return only the extracted values as a comma-separated list.`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: promptText },
                        { inlineData: { mimeType: "image/png", data: base64Image } }
                    ]
                }],
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 100
                }
            })
        });

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        return text.split(",").map(num => num.trim()).filter(num => num.length === 2);
    } catch (error) {
        console.error("Gemini API error:", error);
        return [];
    }
}

function updateNumbersList(number) {
    const list = document.getElementById("numbersList");
    if (!Array.from(list.children).some(li => li.textContent.includes(number))) {
        const listItem = document.createElement("li");
        listItem.textContent = number;

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "✖";
        deleteBtn.classList.add("delete-btn");
        deleteBtn.onclick = () => listItem.remove();

        listItem.appendChild(deleteBtn);
        list.appendChild(listItem);
    }
}

document.getElementById("addNumberBtn").addEventListener("click", () => {
    const input = document.getElementById("manualInput").value.trim();
    if (input.length === 2) {
        updateNumbersList(input);
        document.getElementById("manualInput").value = "";
    } else {
        alert("Invalid input. Enter exactly two characters (e.g., L4, 77).");
    }
});

document.getElementById("markCheckBoxes").addEventListener("click", () => {
    document.getElementById("markingStatus").classList.remove("hidden");

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: markMatchingCheckboxes,
            args: [getExtractedNumbers()]
        }, (result) => {
            document.getElementById("markingStatus").classList.add("hidden");

            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
                return;
            }

            const { marked, notFound } = result[0].result;

            document.getElementById("markedNumbers").innerHTML = marked.length
                ? `✅ Marked: ${marked.join(", ")}`
                : "✅ No numbers marked.";

            document.getElementById("notFoundNumbers").innerHTML = notFound.length
                ? `❌ Not Found: ${notFound.join(", ")}`
                : "❌ All numbers found.";
        });
    });
});

function getExtractedNumbers() {
    return Array.from(document.querySelectorAll("#numbersList li")).map(li => li.textContent.replace("✖", "").trim());
}

function markMatchingCheckboxes(numbers) {
    const checkboxes = document.querySelectorAll("input[type='checkbox']");
    let marked = [];
    let notFound = [];

    if (checkboxes.length === 0) {
        alert("No checkboxes found on this page.");
        return { marked, notFound };
    }

    numbers.forEach(num => {
        let found = false;
        let extractedNum = num.toUpperCase();

        checkboxes.forEach(checkbox => {
            let checkboxName = checkbox.name.toUpperCase();
            if (checkboxName.endsWith(extractedNum)) {
                checkbox.checked = true;
                found = true;
            }
        });

        found ? marked.push(extractedNum) : notFound.push(extractedNum);
    });

    if (marked.length === 0) {
        alert("No matching checkboxes found.");
    }

    return { marked, notFound };
}
