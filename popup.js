const GEMINI_API_KEY = "AIzaSyBa1rUNG9UcKa4YZbrd7QLJlsYhIazG_z8";

document.getElementById("extractBtn").addEventListener("click", async () => {
    const fileInput = document.getElementById("imageInput");
    if (fileInput.files.length === 0) return alert("Please select an image.");

    document.getElementById("loading").classList.remove("hidden");

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async () => {
        try {
            const base64Image = reader.result.split(",")[1];
            const extractedNumbers = await extractNumbersWithGemini(base64Image);

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

async function extractNumbersWithGemini(base64Image) {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: "Extract only two-character values that are either purely numeric (e.g., 77, 09) or alphanumeric (e.g., L4, i7, m2). Do not include extra characters, symbols, or words. Extract only values within the range:  - I1 to I9  - J1 to J9  - K1 to K9  - L1 to L9  - M1 to M9  - N1 to N9  - O1 to O4  If any extracted value is in lowercase, convert it to uppercase in the output. Return only the extracted values as a comma-separated list." },
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

    numbers.forEach(num => {
        let found = false;
        checkboxes.forEach(checkbox => {
            if (checkbox.name.includes(num)) {
                checkbox.checked = true;
                found = true;
            }
        });
        found ? marked.push(num) : notFound.push(num);
    });

    return { marked, notFound };
}
