
"use strict";

// ================================================
// NUMORA - UNIVERSAL NUMBER SYSTEM DIGITAL LAB
// ================================================

// API DOCUMENTATION:
// https://networkcalc.com/api/docs/binary-converter/

const API_URL = "https://networkcalc.com/api/binary/";

const $ = (id) => document.getElementById(id);

const inputNumber = $("inputNumber");
const sourceBase = $("sourceBase");
const convertBtn = $("convertBtn");
const clearBtn = $("clearBtn");
const message = $("message");
const apiStatus = $("apiStatus");

const outputElements = {
    2: $("binaryResult"),
    8: $("octalResult"),
    10: $("decimalResult"),
    16: $("hexResult")
};

let requestId = 0;

// ================================================
// 1. NUMBER SYSTEM CONVERSION ENGINE
// ================================================

function validateNumber(value, base) {
    const patterns = {
        2: /^-?[01]+$/,
        8: /^-?[0-7]+$/,
        10: /^-?[0-9]+$/,
        16: /^-?[0-9a-f]+$/i
    };

    return patterns[base].test(value);
}

function toDecimal(value, base) {
    let number = BigInt(value);

    if (number < 0n) {
        return -toDecimal((-number).toString(), base);
    }

    const digits = "0123456789ABCDEF";
    let result = 0n;

    for (const character of number.toString()) {
        const digit = BigInt(
            digits.indexOf(character.toUpperCase())
        );

        if (digit < 0n || digit >= BigInt(base)) {
            throw new Error("Invalid digit");
        }

        result = result * BigInt(base) + digit;
    }

    return result;
}

function fromDecimal(number, base) {
    if (number < 0n) {
        return "-" + fromDecimal(-number, base);
    }

    return number.toString(base).toUpperCase();
}

function convertLocally(value, fromBase, toBase) {
    const decimal = toDecimal(value, fromBase);
    return fromDecimal(decimal, toBase);
}

// ================================================
// 2. REST API INTEGRATION
// ================================================

async function convertUsingAPI(value, fromBase, toBase) {

    const url =
        API_URL +
        encodeURIComponent(value) +
        `?from=${fromBase}&to=${toBase}`;

    const controller = new AbortController();

    const timeout = setTimeout(() => {
        controller.abort();
    }, 7000);

    try {

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Accept": "application/json"
            },
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error("API HTTP error: " + response.status);
        }

        const data = await response.json();

        if (data.status !== "OK" || data.converted == null) {
            throw new Error("Invalid API response");
        }

        return String(data.converted).toUpperCase();

    } finally {
        clearTimeout(timeout);
    }
}

// ================================================
// 3. STEP-BY-STEP EXPLANATION
// ================================================

function generateSteps(value, base, decimal) {

    const names = {
        2: "Binary",
        8: "Octal",
        10: "Decimal",
        16: "Hexadecimal"
    };

    let steps = [];

    steps.push(
        `Input: ${value} (${names[base]})`
    );

    if (base !== 10) {

        const digits = value.toUpperCase().replace("-", "");
        const digitValues = "0123456789ABCDEF";

        const terms = [...digits].reverse().map((digit, index) => {
            return `${digitValues.indexOf(digit)} × ${base}^${index}`;
        });

        steps.push(
            `Step 1: Expand the number using positional weights.`
        );

        steps.push(
            `Step 2: ${terms.reverse().join(" + ")}`
        );

        steps.push(
            `Step 3: Decimal equivalent = ${decimal}`
        );

    } else {

        steps.push(
            `Step 1: Divide ${value} repeatedly by the target base.`
        );

        steps.push(
            `Step 2: Record each remainder.`
        );

        steps.push(
            `Step 3: Read the remainders from bottom to top.`
        );
    }

    steps.push(
        `Final decimal value: ${decimal}`
    );

    return steps;
}

function showSteps(steps) {

    $("stepsContent").innerHTML = "";

    steps.forEach(step => {

        const div = document.createElement("div");

        div.className = "step-line";
        div.textContent = step;

        $("stepsContent").appendChild(div);

    });
}

// ================================================
// 4. MAIN CONVERTER
// ================================================

async function convertNumber() {

    const value = inputNumber.value.trim();
    const base = Number(sourceBase.value);
    const currentRequest = ++requestId;

    if (!value) {
        message.textContent = "Please enter a number.";
        return;
    }

    if (!validateNumber(value, base)) {
        message.textContent =
            `Invalid input! Please enter valid Base ${base} digits.`;
        return;
    }

    let decimal;

    try {
        decimal = toDecimal(value, base);
    } catch (error) {
        message.textContent = "Unable to convert this number.";
        return;
    }

    message.textContent = "";
    apiStatus.textContent = "Connecting to conversion API...";

    convertBtn.disabled = true;
    convertBtn.textContent = "Converting...";

    const bases = [2, 8, 10, 16];
    let apiSuccess = 0;

    try {

        const results = await Promise.all(
            bases.map(async targetBase => {

                // Avoid an unnecessary API call for identical bases
                if (base === targetBase) {
                    return {
                        base: targetBase,
                        value: value.toUpperCase(),
                        source: "input"
                    };
                }

                // API is used for non-negative values.
                // Large values may use local BigInt conversion.
                if (decimal >= 0n && decimal <= BigInt(Number.MAX_SAFE_INTEGER)) {

                    try {

                        const converted = await convertUsingAPI(
                            value.replace(/^-/, ""),
                            base,
                            targetBase
                        );

                        apiSuccess++;

                        return {
                            base: targetBase,
                            value: converted,
                            source: "API"
                        };

                    } catch (error) {
                        // Use local conversion if API is unavailable
                    }
                }

                return {
                    base: targetBase,
                    value: fromDecimal(decimal, targetBase),
                    source: "Local"
                };
            })
        );

        if (currentRequest !== requestId) return;

        results.forEach(result => {
            outputElements[result.base].textContent = result.value;
        });

        const apiUsed = results.filter(r => r.source === "API").length;

        if (apiUsed > 0) {
            apiStatus.textContent =
                `API connected: ${apiUsed} conversion(s) received from NetworkCalc.`;
        } else {
            apiStatus.textContent =
                "Local JavaScript engine used. API unavailable or not required.";
        }

        const steps = generateSteps(value, base, decimal);
        showSteps(steps);

        message.textContent = "✓ Conversion completed successfully.";

        saveHistory({
            input: value,
            base,
            binary: fromDecimal(decimal, 2),
            octal: fromDecimal(decimal, 8),
            decimal: decimal.toString(),
            hexadecimal: fromDecimal(decimal, 16),
            time: new Date().toLocaleString()
        });

        updateVisualizerFromDecimal(decimal);

    } catch (error) {

        if (currentRequest !== requestId) return;

        message.textContent = "Conversion failed. Please try again.";

    } finally {

        if (currentRequest === requestId) {
            convertBtn.disabled = false;
            convertBtn.textContent = "Convert Number →";
        }
    }
}

convertBtn.addEventListener("click", convertNumber);

inputNumber.addEventListener("keydown", event => {
    if (event.key === "Enter") convertNumber();
});

// ================================================
// 5. PRESET BUTTONS
// ================================================

document.querySelectorAll(".preset").forEach(button => {

    button.addEventListener("click", () => {

        sourceBase.value = "10";
        inputNumber.value = button.dataset.value;

        convertNumber();

    });
});

// ================================================
// 6. CLEAR CONVERTER
// ================================================

clearBtn.addEventListener("click", () => {

    requestId++;

    inputNumber.value = "";

    Object.values(outputElements).forEach(element => {
        element.textContent = "---";
    });

    message.textContent = "";
    apiStatus.textContent = "Waiting for your first conversion.";

    $("stepsContent").textContent =
        "Your conversion steps will appear here.";

    convertBtn.disabled = false;
    convertBtn.textContent = "Convert Number →";

});

// ================================================
// 7. COPY RESULTS
// ================================================

document.querySelectorAll(".copy-btn").forEach(button => {

    button.addEventListener("click", async () => {

        const value = $(button.dataset.target).textContent;

        if (value === "---") {
            message.textContent = "Convert a number first.";
            return;
        }

        try {

            await navigator.clipboard.writeText(value);
            message.textContent = "✓ Copied to clipboard!";

        } catch (error) {

            message.textContent = "Clipboard access unavailable.";

        }
    });

});

// ================================================
// 8. BINARY VISUALIZER
// ================================================

function updateVisualizerFromDecimal(number) {

    if (number < 0n || number > 65535n) return;

    $("visualValue").value = number.toString();

    renderVisualizer();
}

function renderVisualizer() {

    const value = $("visualValue").value;
    const width = Number($("bitWidth").value);

    const display = $("bitDisplay");
    const details = $("bitDetails");

    display.innerHTML = "";
    details.textContent = "";

    if (value === "" || !/^\d+$/.test(value)) {
        details.textContent = "Enter a valid non-negative decimal integer.";
        return;
    }

    const number = BigInt(value);

    if (number > 65535n) {
        details.textContent = "Maximum supported visualizer value is 65535.";
        return;
    }

    const binary = number.toString(2).padStart(width, "0");

    for (let i = 0; i < width; i++) {

        const bit = binary[i];
        const position = width - 1 - i;

        const card = document.createElement("div");
        card.className = "bit" + (bit === "1" ? " active" : "");

        const strong = document.createElement("strong");
        strong.textContent = bit;

        const small = document.createElement("small");
        small.textContent = position;

        card.append(strong, small);
        display.appendChild(card);
    }

    details.textContent =
        `Binary: ${binary} | Decimal: ${number} | Active bits: ${binary.split("1").length - 1}`;
}

$("visualValue").addEventListener("input", renderVisualizer);
$("bitWidth").addEventListener("change", renderVisualizer);

renderVisualizer();

// ================================================
// 9. BINARY ARITHMETIC CALCULATOR
// ================================================

$("calculateBinary").addEventListener("click", () => {

    const a = $("binaryA").value.trim();
    const b = $("binaryB").value.trim();
    const operation = $("binaryOperation").value;

    if (!/^[01]+$/.test(a) || !/^[01]+$/.test(b)) {

        $("binaryAnswer").textContent = "Invalid input";
        $("binaryDecimalAnswer").textContent =
            "Enter only 0 and 1 in both fields.";

        $("binaryCalculationSteps").textContent = "";
        return;
    }

    const first = BigInt("0b" + a);
    const second = BigInt("0b" + b);

    let result;

    if (operation === "+") {
        result = first + second;
    } else if (operation === "-") {
        result = first - second;
    } else if (operation === "*") {
        result = first * second;
    } else if (operation === "/") {

        if (second === 0n) {
            $("binaryAnswer").textContent = "Cannot divide by zero";
            $("binaryDecimalAnswer").textContent = "";
            $("binaryCalculationSteps").textContent = "";
            return;
        }

        result = first / second;
    }

    const binaryResult =
        result < 0n
            ? "-" + (-result).toString(2)
            : result.toString(2);

    $("binaryAnswer").textContent = binaryResult;

    $("binaryDecimalAnswer").textContent =
        "Decimal result: " + result.toString();

    $("binaryCalculationSteps").textContent =
        `${a} ${operation} ${b} = ${binaryResult} (binary)`;
});

// ================================================
// 10. DIGITAL LOGIC GATE SIMULATOR
// ================================================

function updateLogicGates() {

    const a = Number($("logicA").value);
    const b = Number($("logicB").value);

    $("andOutput").textContent = a & b;
    $("orOutput").textContent = a | b;
    $("nandOutput").textContent = 1 - (a & b);
    $("norOutput").textContent = 1 - (a | b);
    $("xorOutput").textContent = a ^ b;
    $("notOutput").textContent = 1 - a;
}

$("logicA").addEventListener("change", updateLogicGates);
$("logicB").addEventListener("change", updateLogicGates);

updateLogicGates();

// ================================================
// 11. QUIZ MODULE
// ================================================

const questions = [
    {
        question: "Which number system uses only 0 and 1?",
        options: ["Decimal", "Binary", "Octal", "Hexadecimal"],
        answer: 1
    },
    {
        question: "What is the base of the octal number system?",
        options: ["2", "8", "10", "16"],
        answer: 1
    },
    {
        question: "What is the binary equivalent of decimal 10?",
        options: ["1001", "1010", "1100", "1110"],
        answer: 1
    },
    {
        question: "What is the hexadecimal equivalent of decimal 15?",
        options: ["A", "B", "E", "F"],
        answer: 3
    },
    {
        question: "How many bits are represented by one hexadecimal digit?",
        options: ["2", "3", "4", "8"],
        answer: 2
    },
    {
        question: "Which logic gate produces 1 only when both inputs are 1?",
        options: ["OR", "NOT", "AND", "XOR"],
        answer: 2
    }
];

let questionIndex = 0;
let score = 0;
let answered = false;

function loadQuestion() {

    answered = false;

    const question = questions[questionIndex];

    $("questionNumber").textContent =
        `QUESTION ${questionIndex + 1} / ${questions.length}`;

    $("quizScore").textContent = `SCORE: ${score}`;

    $("quizProgress").style.width =
        `${(questionIndex / questions.length) * 100}%`;

    $("questionText").textContent = question.question;

    $("quizFeedback").textContent = "";

    $("nextQuestion").disabled = true;

    $("nextQuestion").textContent =
        questionIndex === questions.length - 1
            ? "View Final Score →"
            : "Next Question →";

    $("quizOptions").innerHTML = "";

    question.options.forEach((option, index) => {

        const button = document.createElement("button");

        button.className = "quiz-option";
        button.textContent = option;

        button.addEventListener("click", () => {

            if (answered) return;

            answered = true;

            const correct = index === question.answer;

            if (correct) {
                score++;
                button.classList.add("correct");
                $("quizFeedback").textContent = "✓ Correct answer! Well done.";
            } else {
                button.classList.add("wrong");
                $("quizFeedback").textContent =
                    "Incorrect. Correct answer: " +
                    question.options[question.answer];
            }

            Array.from($("quizOptions").children).forEach((element, i) => {

                element.disabled = true;

                if (i === question.answer) {
                    element.classList.add("correct");
                }
            });

            $("quizScore").textContent = `SCORE: ${score}`;

            $("nextQuestion").disabled = false;
        });

        $("quizOptions").appendChild(button);
    });
}

$("nextQuestion").addEventListener("click", () => {

    if (!answered) return;

    if (questionIndex < questions.length - 1) {

        questionIndex++;
        loadQuestion();

    } else {

        $("questionText").textContent =
            `Quiz Completed! Your score is ${score} / ${questions.length}.`;

        $("quizOptions").innerHTML = "";

        $("quizFeedback").textContent =
            score === questions.length
                ? "Excellent! You answered every question correctly."
                : "Keep practicing. You can try again!";

        $("quizProgress").style.width = "100%";

        $("nextQuestion").classList.add("hidden");
        $("restartQuiz").classList.remove("hidden");
    }
});

$("restartQuiz").addEventListener("click", () => {

    questionIndex = 0;
    score = 0;

    $("restartQuiz").classList.add("hidden");
    $("nextQuestion").classList.remove("hidden");

    loadQuestion();
});

loadQuestion();

// ================================================
// 12. CONVERSION HISTORY
// ================================================

const HISTORY_KEY = "numora_conversion_history";

function getHistory() {

    try {
        return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch {
        return [];
    }
}

function saveHistory(item) {

    const history = getHistory();

    history.unshift(item);

    // Keep only the last 20 conversions
    localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(history.slice(0, 20))
    );

    renderHistory();
}

function renderHistory() {

    const container = $("historyList");
    const history = getHistory();

    container.innerHTML = "";

    if (history.length === 0) {

        container.textContent =
            "No conversions yet. Try your first conversion!";

        return;
    }

    history.forEach(item => {

        const row = document.createElement("div");
        row.className = "history-row";

        const info = document.createElement("div");

        const title = document.createElement("strong");

        title.textContent =
            `${item.input} (Base ${item.base}) → ${item.binary}`;

        const date = document.createElement("small");
        date.textContent = item.time;

        info.append(title, document.createElement("br"), date);

        const copy = document.createElement("button");

        copy.textContent = "Copy Binary";

        copy.addEventListener("click", async () => {

            try {
                await navigator.clipboard.writeText(item.binary);
                message.textContent = "History result copied!";
            } catch {
                message.textContent = "Clipboard unavailable.";
            }
        });

        row.append(info, copy);
        container.appendChild(row);

    });
}

$("clearHistory").addEventListener("click", () => {

    localStorage.removeItem(HISTORY_KEY);
    renderHistory();

});

renderHistory();

// ================================================
// 13. DARK AND LIGHT THEME
// ================================================

const themeBtn = $("themeBtn");

function setTheme(theme) {

    document.body.classList.toggle("light", theme === "light");

    themeBtn.textContent =
        theme === "light" ? "☾" : "☀";

    localStorage.setItem("numora_theme", theme);
}

themeBtn.addEventListener("click", () => {

    const nextTheme =
        document.body.classList.contains("light")
            ? "dark"
            : "light";

    setTheme(nextTheme);
});

setTheme(localStorage.getItem("numora_theme") || "dark");

// ================================================
// NUMORA INITIALIZATION COMPLETE
// ================================================

console.log("NUMORA Digital Lab initialized successfully.");
console.log("Number conversion engine: Ready");
console.log("Binary visualizer: Ready");
console.log("Arithmetic calculator: Ready");
console.log("Logic gates: Ready");
console.log("Quiz module: Ready");
console.log("History storage: Ready");
