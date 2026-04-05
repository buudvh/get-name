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
    if (url.includes("sangtacviet") || url.includes("14.225.254.182") || url.includes("103.82.20.93")) {
        return "sangtacviet";
    } else if (url.includes("truyenwikidich") || url.includes("wikidich") || url.includes("wikicv")) {
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

        // Điều kiện 3: Loại bỏ name không có tiếng trung
        if (!hasChinese(chinesePart)) {
            invalidLines.push({
                line: trimmedLine,
                reason: `Phần tiếng Trung không có tiếng Trung: "${vietnamesePart}"`
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

function hasChinese(str) {
    const rootChineseRegex = /[\u4E00-\u9FFF]/;
    return rootChineseRegex.test(str);
}

// Sangtacviet functions
function parseNamesFromJson(jsonData, bookname) {
    const names = [];
    const bookNameBeauty = bookname.replace(/[^a-zA-Z0-9\s\u00C0-\u1EF9]/g, '')
        .split(' ') // Tách chuỗi thành mảng dựa trên dấu gạch ngang
        .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Viết hoa chữ đầu mỗi từ
        .join('');

    if (jsonData && jsonData.result && jsonData.result.div) {
        jsonData.result.div.forEach((content, index) => {
            const title = `${bookname} (Gói ${index + 1})`;

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
                bookname: bookNameBeauty
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

        const bookname = await fetchNamesBookSTV(host, bookhost, bookid);

        return parseNamesFromJson(processedData, bookname);
    } catch (error) {
        console.error("Fetch error:", error);
        throw new Error(`Lỗi khi tải dữ liệu: ${error.message}`);
    }
}

async function fetchNamesBookSTV(host, bookhost, bookid) {
    const apiUrl = `${host}/truyen/${bookhost}/1/${bookid}/`;
    const proxyUrl = `https://web.scraper.workers.dev/?url=${encodeURIComponent(
        apiUrl
    )}&selector=h1&scrape=text&pretty=true`;

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
            !data.result.h1 ||
            data.result.h1.length === 0
        ) {
            throw new Error("Không lấy được tên truyện");
        }

        return data.result.h1[0];
    } catch (error) {
        return "NoName"
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

        let bookid = htmlDoc.getElementById('bookId')?.value;

        const nameUrl = `https://wikicv.net/name-list?bookId=${bookid}&id=COMMON`;
        const responseName = await fetch(nameUrl);
        if (!responseName.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const jsonData = await responseName.json();
        const htmlDocName = parser.parseFromString(jsonData.data.content, "text/html");

        let textContent = htmlDocName.body.innerText || '';
        let outputText = [];
        let validLines = [];
        let invalidLines = [];

        textContent.split(/\r?\n/).forEach((e) => {
            const trimmed = e.trim();
            if (trimmed) {
                outputText.push(trimmed);
                // Tách phần tiếng Trung và tiếng Việt
                const parts = trimmed.split('=');
                if (parts.length !== 2) {
                    invalidLines.push({ line: trimmed, reason: 'Không đúng format $中文=Tiếng Việt' });
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
                        line: trimmed,
                        reason: `Chỉ có 1 ký tự tiếng Trung: "${chinesePart}"`
                    });
                    return;
                }

                // Điều kiện 2: Loại bỏ name không có từ tiếng Việt nào viết hoa
                if (!hasAtLeastOneCapitalizedWord(vietnamesePart)) {
                    invalidLines.push({
                        line: trimmed,
                        reason: `Không có từ tiếng Việt nào viết hoa: "${vietnamesePart}"`
                    });
                    return;
                }

                // Name hợp lệ
                validLines.push(trimmed);
            }
        });

        let content = outputText.join("\n");
        content = content.replace(/^\s*$(?:\r\n?|\n)/gm, "");

        let validContent = validLines.join("\n");
        validContent = validContent.replace(/^\s*$(?:\r\n?|\n)/gm, "");

        console.log(invalidLines);

        // Extract title from URL
        let name = url.split(/[/ ]+/).pop();
        const title = name
            .split('-') // Tách chuỗi thành mảng dựa trên dấu gạch ngang
            .map(word => word.length <= 7 ? word.charAt(0).toUpperCase() + word.slice(1) : "") // Viết hoa chữ đầu mỗi từ
            .join(' ');
        const bookname = name
            .split('-') // Tách chuỗi thành mảng dựa trên dấu gạch ngang
            .map(word => word.length <= 7 ? word.charAt(0).toUpperCase() + word.slice(1) : "") // Viết hoa chữ đầu mỗi từ
            .join('');
        let temp = name.split(/[- ]+/).pop();
        name = name.replace("-" + temp, "");

        return [
            {
                title: title,
                content: content,
                content: validContent,
                originalContent: content,
                index: 0,
                site: "wikidich",
                originalName: name,
                invalidCount: invalidLines.length,
                invalidLines: invalidLines,
                bookname: bookname,
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
    const linesOriginal = nameData.originalContent.split(/\n/).filter((line) => line.trim());
    const displayContent = lines.slice(0, 8).join("\n");
    const hasMore = lines.length > 8;
    const nameCount = lines.length;
    const nameOriginalCount = linesOriginal.length;

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
                    📊 ${nameCount}/${nameOriginalCount} names 
                </div>
            </div>
            ${filterInfo}
            <div class="name-content">${displayContent}${hasMore ? "\n... và nhiều hơn nữa" : ""}</div>
            <div class="name-actions">
                <button class="btn btn-small" onclick="downloadNameFile('${nameData.bookname}', ${nameData.index}, false)">
                    📥 Tải name đã lọc
                </button>
                ${nameData.invalidLines.length > 0 ?
            `<button class="btn btn-small btn-tertiary" onclick="downloadNameFile('${nameData.bookname}', ${nameData.index}, true)">
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

    const modal = document.getElementById("invalidNamesModal");
    const body = document.getElementById("invalidNamesBody");
    const closeBtn = document.querySelector(".close-modal");

    // Tạo nội dung HTML thay vì string thô
    const htmlContent = nameData.invalidLines.map(item => `
        <div class="invalid-item">
            <div>${item.line}</div>
            <div class="reason-text">➔ ${item.reason}</div>
        </div>
    `).join('');

    body.innerHTML = htmlContent;
    modal.style.display = "block";

    // Đóng modal khi click nút X
    closeBtn.onclick = () => modal.style.display = "none";

    // Đóng modal khi click ra ngoài vùng xám
    window.onclick = (event) => {
        if (event.target == modal) modal.style.display = "none";
    };
}

function downloadNameFile(title, index, useOriginal = false) {
    const nameData = currentNamesData[index];
    if (!nameData) return;

    // Chọn content gốc hoặc đã lọc
    let content = useOriginal && nameData.originalContent ? nameData.originalContent : nameData.content;
    let filename;

    if (nameData.site === "wikidich") {
        filename = `${title}.txt`;
    } else {
        // Sangtacviet
        if (content.startsWith("$")) {
            content = content.substring(1);
        }
        content = content.replace(/\n\$/g, "\n").replace(/\$/g, "\n");

        const suffix = useOriginal ? "ORIGINAL.txt" : "FILTERED.txt";
        filename = `${title}_${suffix}`;
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
                    trimmedText.includes("14.225.254.182") ||
                    trimmedText.includes("103.82.20.93")) &&
                trimmedText.includes("/truyen/")) ||
            (trimmedText.includes("wikicv") && trimmedText.includes("/truyen/"))
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
