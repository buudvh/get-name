let currentNamesData = [];

// Utility functions
function showStatus(message, type) {
    const statusDiv = document.getElementById("status");
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = "block";

    if (type === "loading") {
        statusDiv.innerHTML = `<div class="loading-spinner"></div>${message}`;
    } else {
        statusDiv.innerHTML = message;
    }
}

function hideStatus() {
    const statusDiv = document.getElementById("status");
    statusDiv.style.display = "none";
}

function detectWebsite(url) {
    if (url.includes("sangtacviet") || url.includes("14.225.254.182")) {
        return "sangtacviet";
    } else if (url.includes("truyenwikidich") || url.includes("wikidich")) {
        return "wikidich";
    }
    return null;
}

// Hàm kiểm tra xem chuỗi có phải tiếng Trung không
function isChineseWord(word) {
    return /[\u4e00-\u9fff]/.test(word);
}

// Hàm đếm số từ trong chuỗi (tách bởi khoảng trắng)
function countWords(text) {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

// Hàm kiểm tra xem từ có viết hoa chữ cái đầu không
function isCapitalized(word) {
    if (!word || word.length === 0) return false;
    return word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase();
}

// Hàm kiểm tra xem có ít nhất 1 từ viết hoa trong chuỗi không
function hasAtLeastOneCapitalizedWord(text) {
    const words = text.trim().split(/\s+/);
    return words.some(word => isCapitalized(word));
}

// Hàm lọc names hợp lệ cho Sangtacviet
function filterSangtacvietNames(content) {
    const lines = content.split('\n').filter(line => line.trim());
    const validLines = [];
    const invalidLines = [];

    lines.forEach(line => {
        const trimmedLine = line.trim();

        // Bỏ qua dòng trống
        if (!trimmedLine) return;

        // Loại bỏ $ ở đầu nếu có
        let processedLine = trimmedLine;
        if (processedLine.startsWith('$')) {
            processedLine = processedLine.substring(1);
        }

        // Tách phần tiếng Trung và tiếng Việt
        const parts = processedLine.split('=');
        if (parts.length !== 2) {
            invalidLines.push({ line: trimmedLine, reason: 'Không đúng format $中文=Tiếng Việt' });
            return;
        }

        const chinesePart = parts[0].trim();
        const vietnamesePart = parts[1].trim();

        // Đếm số ký tự tiếng Trung
        const chineseChars = chinesePart.split('').filter(char => isChineseWord(char));
        const chineseCharCount = chineseChars.length;

        // Điều kiện 1: Loại bỏ name chỉ có 1 ký tự tiếng Trung
        if (chineseCharCount === 1) {
            invalidLines.push({
                line: trimmedLine,
                reason: `Chỉ có 1 ký tự tiếng Trung: "${chinesePart}"`
            });
            return;
        }

        // Điều kiện 2: Loại bỏ name không có từ tiếng Việt nào viết hoa
        if (!hasAtLeastOneCapitalizedWord(vietnamesePart)) {
            invalidLines.push({
                line: trimmedLine,
                reason: `Không có từ tiếng Việt nào viết hoa: "${vietnamesePart}"`
            });
            return;
        }

        // Name hợp lệ
        validLines.push(trimmedLine);
    });

    return {
        validContent: validLines.join('\n'),
        validCount: validLines.length,
        invalidCount: invalidLines.length,
        invalidLines: invalidLines
    };
}

// Sangtacviet functions
function parseNamesFromJson(jsonData) {
    const names = [];

    if (jsonData && jsonData.result && jsonData.result.div) {
        jsonData.result.div.forEach((content, index) => {
            const title = `Gói ${index + 1}`;

            // Lọc names hợp lệ
            const filtered = filterSangtacvietNames(content);

            names.push({
                title: title,
                content: filtered.validContent,
                originalContent: content,
                validCount: filtered.validCount,
                invalidCount: filtered.invalidCount,
                invalidLines: filtered.invalidLines,
                index: index,
                site: "sangtacviet",
            });
        });
    }

    return names;
}

async function fetchSangtacvietData(url) {
    if (url.slice(-1) === "/") url = url.slice(0, -1);

    const urlParts = url.split("/truyen/");
    if (urlParts.length !== 2) {
        throw new Error("URL không đúng định dạng!");
    }

    let host = urlParts[0];
    host = host.replace(
        /^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n?]+)/gim,
        "http://sangtacviet.app"
    );
    const params = urlParts[1].split("/");
    const bookhost = params[0];
    const bookid = params[2];

    if (!bookhost || !bookid) {
        throw new Error("Không thể lấy thông tin host hoặc book ID!");
    }

    const apiUrl = `${host}/namesys.php?host=${bookhost}&book=${bookid}`;
    const proxyUrl = `https://web.scraper.workers.dev/?url=${encodeURIComponent(
        apiUrl
    )}&selector=div&scrape=text&pretty=true`;

    try {
        const response = await fetch(proxyUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("API Response:", data);

        if (
            !data ||
            !data.result ||
            !data.result.div ||
            data.result.div.length === 0
        ) {
            throw new Error("Truyện không có name được chia sẻ!");
        }

        const processedData = {
            result: {
                div: data.result.div.map((item) => {
                    let processedItem = item;
                    if (processedItem.startsWith("$")) {
                        processedItem = processedItem.substring(1);
                    }
                    processedItem = processedItem.replace(/\n\$/g, "\n");
                    return processedItem;
                }),
            },
        };

        return parseNamesFromJson(processedData);
    } catch (error) {
        console.error("Fetch error:", error);
        throw new Error(`Lỗi khi tải dữ liệu: ${error.message}`);
    }
}

async function fetchWikidichData(url) {
    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.text();
        const parser = new DOMParser();
        const htmlDoc = parser.parseFromString(data, "text/html");

        let textInput = htmlDoc.getElementById("ddListName");
        if (!textInput) {
            throw new Error("Không tìm thấy danh sách names trên trang này!");
        }

        let textContent = textInput.textContent || textInput.innerText;
        let outputText = [];

        textContent.split(/\r?\n/).forEach((e) => {
            const trimmed = e.trim();
            if (trimmed) {
                outputText.push(trimmed);
            }
        });

        let content = outputText.join("\n");
        content = content.replace(/^\s*$(?:\r\n?|\n)/gm, "");

        // Extract title from URL
        let name = url.split(/[/ ]+/).pop();
        let temp = name.split(/[- ]+/).pop();
        name = name.replace("-" + temp, "");

        return [
            {
                title: `${name}`,
                content: content,
                index: 0,
                site: "wikidich",
                originalName: name,
            },
        ];
    } catch (error) {
        console.error("Wikidich fetch error:", error);
        throw new Error(`Lỗi khi tải dữ liệu từ Wikidich: ${error.message}`);
    }
}

// UI functions
function createNameItem(nameData) {
    const lines = nameData.content.split(/\n/).filter((line) => line.trim());
    const displayContent = lines.slice(0, 8).join("\n");
    const hasMore = lines.length > 8;
    const nameCount = lines.length;

    // Hiển thị thông tin lọc cho Sangtacviet
    let filterInfo = '';
    if (nameData.site === 'sangtacviet' && nameData.invalidCount > 0) {
        filterInfo = `<div class="filter-info">✅ ${nameData.validCount} hợp lệ | ❌ ${nameData.invalidCount} bị lọc</div>`;
    }

    return `
        <div class="name-item">
            <div class="name-header">
                <div class="name-title">${nameData.title}</div>
                <div class="name-meta">
                    📊 ${nameCount} names 
                </div>
            </div>
            ${filterInfo}
            <div class="name-content">${displayContent}${hasMore ? "\n... và nhiều hơn nữa" : ""}</div>
            <div class="name-actions">
                <button class="btn btn-small" onclick="downloadNameFile('${nameData.title}', ${nameData.index}, false)">
                    📥 Tải name đã lọc
                </button>
                ${nameData.site === 'sangtacviet' && nameData.invalidCount > 0 ?
            `<button class="btn btn-small btn-tertiary" onclick="downloadNameFile('${nameData.title}', ${nameData.index}, true)">
                        📦 Tải name gốc
                    </button>
                    <button class="btn btn-small btn-secondary" onclick="showInvalidNames(${nameData.index})">
                        🔍 Xem bị lọc
                    </button>` : ''}
            </div>
        </div>
    `;
}

function showInvalidNames(index) {
    const nameData = currentNamesData[index];
    if (!nameData || !nameData.invalidLines || nameData.invalidLines.length === 0) return;

    const invalidList = nameData.invalidLines.map(item =>
        `${item.line}\n  → ${item.reason}`
    ).join('\n\n');

    alert(`Names bị lọc bỏ (${nameData.invalidLines.length}):\n\n${invalidList}`);
}

function downloadNameFile(title, index, useOriginal = false) {
    const nameData = currentNamesData[index];
    if (!nameData) return;

    // Chọn content gốc hoặc đã lọc
    let content = useOriginal && nameData.originalContent ? nameData.originalContent : nameData.content;
    let filename;

    if (nameData.site === "wikidich") {
        filename = `Names_${nameData.originalName || "wikidich"}_.txt`;
    } else {
        // Sangtacviet
        if (content.startsWith("$")) {
            content = content.substring(1);
        }
        content = content.replace(/\n\$/g, "\n").replace(/\$/g, "\n");

        const suffix = useOriginal ? "_ORIGINAL_STV.txt" : "_FILTERED_STV.txt";
        filename = `${title.replace(/\s/g, "_")}${suffix}`;
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const fileType = useOriginal ? "gốc (chưa lọc)" : "đã lọc";
    showStatus(`Đã tải xuống "${title}" - ${fileType}`, "success");
}

// Main fetch function
async function fetchNamesData(url) {
    const site = detectWebsite(url);

    if (site === "sangtacviet") {
        return await fetchSangtacvietData(url);
    } else if (site === "wikidich") {
        return await fetchWikidichData(url);
    } else {
        throw new Error(
            "URL không được hỗ trợ! Chỉ hỗ trợ Sangtacviet và Wikidich."
        );
    }
}

// Clipboard function
async function getUrlFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        const trimmedText = text.trim();

        console.log("Clipboard content:", trimmedText);

        if (
            (trimmedText &&
                (trimmedText.includes("sangtacviet") ||
                    trimmedText.includes("14.225.254.182")) &&
                trimmedText.includes("/truyen/")) ||
            (trimmedText.includes("wikidich") && trimmedText.includes("/truyen/"))
        ) {
            return trimmedText;
        }

        return null;
    } catch (error) {
        console.log("Lỗi khi đọc clipboard:", error);
        return null;
    }
}

// Event listeners
document
    .getElementById("pasteBtn")
    .addEventListener("click", async function () {
        const urlInput = document.getElementById("urlInput");
        const clipboardUrl = await getUrlFromClipboard();
        if (clipboardUrl) {
            urlInput.value = clipboardUrl;
            showStatus("✅ Đã dán URL từ clipboard!", "success");
        } else {
            showStatus("❌ Không thể lấy URL từ clipboard!", "error");
        }
    });

document
    .getElementById("searchForm")
    .addEventListener("submit", async function (e) {
        e.preventDefault();

        const urlInput = document.getElementById("urlInput");
        const searchBtn = document.getElementById("searchBtn");
        const namesList = document.getElementById("namesList");
        const namesContainer = document.getElementById("namesContainer");
        let url = urlInput.value.trim();

        if (!url.includes("/truyen/")) {
            showStatus("URL không đúng định dạng!", "error");
            return;
        }

        const site = detectWebsite(url);
        if (!site) {
            showStatus(
                "URL không được hỗ trợ! Chỉ hỗ trợ Sangtacviet và Wikidich.",
                "error"
            );
            return;
        }

        searchBtn.disabled = true;
        searchBtn.textContent = "Đang tìm...";
        showStatus(`Đang tìm kiếm names từ ${site}...`, "loading");
        namesList.style.display = "none";

        try {
            const names = await fetchNamesData(url);
            currentNamesData = names;

            if (names.length === 0) {
                showStatus("Không tìm thấy names nào!", "error");
                return;
            }

            namesContainer.innerHTML = names.map(createNameItem).join("");
            namesList.style.display = "block";

            const totalNames = names.reduce((total, nameData) => {
                const lines = nameData.content
                    .split(/\n/)
                    .filter((line) => line.trim());
                return total + lines.length;
            }, 0);

            const totalInvalid = names.reduce((total, nameData) => {
                return total + (nameData.invalidCount || 0);
            }, 0);

            let statusMsg = `Tìm thấy ${names.length} gói names với ${totalNames} names hợp lệ từ ${site}!`;
            if (totalInvalid > 0) {
                statusMsg += ` (đã lọc bỏ ${totalInvalid} names không hợp lệ)`;
            }

            showStatus(statusMsg, "success");
        } catch (error) {
            console.error("Error:", error);
            showStatus(`Lỗi: ${error.message}`, "error");
        } finally {
            searchBtn.disabled = false;
            searchBtn.textContent = "Tìm Names";
        }
    });

document.getElementById("urlInput").addEventListener("input", function () {
    hideStatus();
});

// Make functions globally accessible
window.downloadNameFile = downloadNameFile;
window.showInvalidNames = showInvalidNames;