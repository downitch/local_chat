// get last session conversation if any exists
const MEMORY_LANE = "ais_last_session_memory";
const AGENTS_STORAGE_KEY = "agentsmd";
const JOB_IN_ACTION = "job_in_action";

let agentsmd = window.localStorage.getItem(AGENTS_STORAGE_KEY) || "";
let memory = window.localStorage.getItem(MEMORY_LANE) || [];
let jobInAction = window.localStorage.getItem(JOB_IN_ACTION) || "";

setTimeout(() => {
  if(agentsmd) agentsButton.textContent = "AGENTS.md+";
  try {
    if(memory) memory = JSON.parse(memory);
    else window.localStorage.setItem(MEMORY_LANE, JSON.stringify([]));
  } catch(e) {
    console.log(e);
    console.log('--- Memory was cleared due to corruption... ---');
    window.localStorage.setItem(MEMORY_LANE, JSON.stringify([]));
  }
  if(memory) memory.map(part => appendMessage(part));
}, 1000);

setTimeout(async () => {
  if(jobInAction) {
    showInputLoader();
    await pollJob(jobInAction);
    hideInputLoader();
  }
}, 1800);

const md = window.markdownit({
  html: false,
  linkify: true,
  breaks: true
});

const agentsButton = document.getElementById("agents-button");
const agentsFileInput = document.getElementById("agents-file-input");
const textarea = document.getElementById("input-window-textarea");
const responseWindow = document.getElementById("response-window");
const inputWindow = document.getElementById("input-window");
const inputLoading = document.getElementById("input-loading");
let isWaiting = false;

agentsButton.addEventListener("click", () => agentsFileInput.click());

agentsFileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.name.endsWith(".md")) {
    alert("Only .md files allowed");
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    agentsmd = e.target.result;
    localStorage.setItem(AGENTS_STORAGE_KEY, agentsmd);
    agentsButton.textContent = "AGENTS.md+";
  };
  reader.readAsText(file);
});

// textarea auto grow
textarea.addEventListener("input", () => {
  textarea.style.height = "auto";
  textarea.style.height = textarea.scrollHeight + "px";
});

// send on enter
textarea.addEventListener("keydown", async (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    if (isWaiting) return;
    const message = textarea.value.trim();
    if (!message) return;
    isWaiting = true;
    showInputLoader();
    inputWindow.classList.add("disabled");
    // add user message
    appendMessage({ content: message, role: "user", error: null, markdown: true, keep: true });

    try {
      let reqBody = await JSON.parse(localStorage.getItem(MEMORY_LANE)).map(el => { return { role: el.role, content: el.content } });
      // reqBody.push({ role: "user", message });
      // console.log(reqBody);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          agentsmd: agentsmd,
          messages: reqBody,
        })
      });
      const body = await response.json();
      if (!body.jobId) {
        throw new Error("No job id");
      }
      textarea.value = "";
      textarea.style.height = "auto";
      await pollJob(body.jobId);
    } catch (err) {
      console.error(err);
      appendMessage({
        content: "There was an issue with request creation. Try again later...",
        role: "assistant",
        error: err,
      });
    }
    isWaiting = false;
    hideInputLoader();
    inputWindow.classList.remove("disabled");
    textarea.focus();
  }

});

async function pollJob(jobId) {
  saveJobId(jobId);
  let failures = 0;
  const MAX_FAILURES = 50;
  while (true) {
    await sleep(1500);
    try {
      const response = await fetch(`/api/job/${jobId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const rawBody = await response.json();
      const body = rawBody.response;
      console.log("poll:", body);
      // still processing
      if (body.status === "processing") {
        continue;
      }
      // success
      if (body.status === "done") {
        appendMessage({
          content: body.response.content || body.response,
          role: "assistant",
          markdown: true,
          keep: true,
        });
        purgeJobId();
        return;
      }
      // backend-side error
      if (body.status === "error") {
        appendMessage({
          content: "I was unable to process your request... Please, try sending it again!",
          role: "assistant",
          error: "AI response error, check backend",
        });
        purgeJobId();
        return;
      }
    } catch (err) {
      failures++;
      console.error(
        "poll failure",
        failures,
        err
      );
      // tolerate temporary failures
      if (failures < MAX_FAILURES) {
        continue;
      }
      appendMessage({
        content: "Seems like there is an issue with backend... Check your server!",
        role: "assistant",
        error: "Max retries limit hit, check backend",
      });
      purgeJobId();
      return;
    }
  }
}

function appendMessage(contents) {
  let {
    content, role, markdown, error, keep
  } = contents;
  keep = keep ? keep : false;
  error = error ? error : null;
  markdown = markdown ? markdown : false;
  const bubble = document.createElement("div");
  bubble.classList.add("message");
  bubble.classList.add(role);
  if (markdown) {
    bubble.innerHTML = md.render(content);
  } else {
    bubble.textContent = content;
  }
  responseWindow.appendChild(bubble);
  scrollToBottom();
  if(keep) appendToMemory({ role, content, markdown });
}

function appendToMemory(input) {
  let newMemory = JSON.parse(window.localStorage.getItem(MEMORY_LANE));
  newMemory.push(input);
  console.log(newMemory);
  window.localStorage.setItem(MEMORY_LANE, JSON.stringify(newMemory));
}

function scrollToBottom() {
  responseWindow.scrollTop = responseWindow.scrollHeight;
}

function showInputLoader() {
  textarea.style.display = "none";
  inputLoading.style.display = "flex";
}

function hideInputLoader() {
  textarea.style.display = "block";
  inputLoading.style.display = "none";
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getJobId() {
  window.localStorage.getItem(JOB_IN_ACTION);
}

function saveJobId(JID) {
  window.localStorage.setItem(JOB_IN_ACTION, `${JID}`);
}

function purgeJobId() {
  window.localStorage.removeItem(JOB_IN_ACTION);
}