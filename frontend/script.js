const API_BASE_URL = "https://3xv0xuv0ze.execute-api.ap-south-1.amazonaws.com";
const STORAGE_KEY = "taskflow-student-tasks-v1";

const $ = (selector) => document.querySelector(selector);

const taskList = $("#taskList");
const emptyState = $("#emptyState");
const taskDialog = $("#taskDialog");
const taskForm = $("#taskForm");
const toast = $("#toast");

let activeFilter = "all";
let searchQuery = "";
let tasks = [];
async function fetchTasksFromAPI() {
  try {
    const response = await fetch(`${API_BASE_URL}/tasks`);

    if (!response.ok) {
      throw new Error("Failed to fetch tasks");
    }

    const data = await response.json();

    tasks = (data.tasks || []).map((task) => ({
      id: task.taskID,
      title: task.title,
      description: task.description || "",
      priority: (task.priority || "medium").charAt(0).toUpperCase()
        + (task.priority || "medium").slice(1),
      dueDate: task.dueDate || "",
      completed: Boolean(task.completed),
      createdAt: Number(task.createdAt) || Date.now()
    }));

    render();
  } catch (error) {
    console.error("AWS task loading error:", error);
    showToast("Could not load tasks from AWS. Check your connection.");
  }
}
let toastTimeout;



function isValidTask(task) {
  return task &&
    typeof task.id === "string" &&
    typeof task.title === "string" &&
    typeof task.completed === "boolean";
}



function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function todayString() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isOverdue(task) {
  return Boolean(task.dueDate) &&
    task.dueDate < todayString() &&
    !task.completed;
}

function formatDate(dateString) {
  if (!dateString) return "No due date";

  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

function getVisibleTasks() {
  let result = [...tasks];

  if (activeFilter === "pending") {
    result = result.filter((task) => !task.completed);
  } else if (activeFilter === "completed") {
    result = result.filter((task) => task.completed);
  } else if (activeFilter === "overdue") {
    result = result.filter(isOverdue);
  }

  if (searchQuery) {
    const query = searchQuery.toLowerCase();

    result = result.filter((task) =>
      `${task.title} ${task.description || ""} ${task.priority}`
        .toLowerCase()
        .includes(query)
    );
  }

  const sort = $("#sortSelect").value;

  result.sort((a, b) => {
    if (sort === "due") {
      const aDate = a.dueDate || "9999-12-31";
      const bDate = b.dueDate || "9999-12-31";
      return aDate.localeCompare(bDate);
    }

    if (sort === "priority") {
      const rank = { High: 0, Medium: 1, Low: 2 };
      return (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1);
    }

    if (sort === "title") {
      return a.title.localeCompare(b.title);
    }

    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  return result;
}

function renderTask(task) {
  const overdue = isOverdue(task);
  const priority = ["Low", "Medium", "High"].includes(task.priority)
    ? task.priority
    : "Medium";

  return `
    <article class="task-card ${task.completed ? "is-completed" : ""}">
      <button
        class="complete-button ${task.completed ? "checked" : ""}"
        data-action="toggle"
        data-id="${escapeHTML(task.id)}"
        aria-label="${task.completed ? "Mark incomplete" : "Mark complete"}: ${escapeHTML(task.title)}"
        aria-pressed="${task.completed}"
        title="${task.completed ? "Mark incomplete" : "Mark complete"}"
      >${task.completed ? "✓" : ""}</button>

      <div class="task-body">
        <h3 class="task-title">${escapeHTML(task.title)}</h3>
        ${task.description ? `
          <p class="task-description">${escapeHTML(task.description)}</p>
        ` : ""}

        <div class="task-meta">
          <span class="priority priority-${priority.toLowerCase()}">
            ● ${priority} priority
          </span>
          <span class="due-badge ${overdue ? "overdue" : ""}">
            ${overdue ? "⚑ Overdue · " : "◷ "}
            ${escapeHTML(formatDate(task.dueDate))}
          </span>
        </div>
      </div>

      <div class="task-actions">
        <button class="task-action" data-action="edit"
          data-id="${escapeHTML(task.id)}" aria-label="Edit ${escapeHTML(task.title)}"
          title="Edit task">✎</button>
        <button class="task-action delete" data-action="delete"
          data-id="${escapeHTML(task.id)}" aria-label="Delete ${escapeHTML(task.title)}"
          title="Delete task">⌫</button>
      </div>
    </article>
  `;
}

function renderStats() {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.completed).length;
  const pending = total - completed;
  const progress = total ? Math.round(completed / total * 100) : 0;

  $("#totalStat").textContent = total;
  $("#pendingStat").textContent = pending;
  $("#completedStat").textContent = completed;
  $("#progressStat").textContent = progress;
  $("#progressBar").style.width = `${progress}%`;
  $("#allCount").textContent = total;
}

function renderTasks() {
  const visibleTasks = getVisibleTasks();

  taskList.innerHTML = visibleTasks.map(renderTask).join("");
  emptyState.hidden = visibleTasks.length > 0;
  taskList.hidden = visibleTasks.length === 0;

  $("#listCount").textContent =
    `${visibleTasks.length} ${visibleTasks.length === 1 ? "task" : "tasks"}`;

  if (tasks.length === 0) {
    $("#emptyTitle").textContent = "A fresh start!";
    $("#emptyDescription").textContent =
      "Add your first task and start making progress.";
  } else if (searchQuery || activeFilter !== "all") {
    $("#emptyTitle").textContent = "No matching tasks";
    $("#emptyDescription").textContent =
      "Try a different search or choose another filter.";
  } else {
    $("#emptyTitle").textContent = "You're all caught up!";
    $("#emptyDescription").textContent =
      "You've finished everything. Add another task when you're ready.";
  }
}

function renderFilters() {
  document.querySelectorAll("[data-filter]").forEach((button) => {
    const active = button.dataset.filter === activeFilter;
    button.classList.toggle("active", active);

    if (button.classList.contains("nav-item")) {
      if (active) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    }
  });

  const labels = {
    all: "All tasks",
    pending: "Pending",
    completed: "Completed",
    overdue: "Overdue"
  };

  $("#pageLabel").textContent = labels[activeFilter];
  $("#listHeading").textContent =
    activeFilter === "all" ? "Your tasks" : labels[activeFilter];

  $("#listDescription").textContent = {
    all: "Everything you want to get done, in one place.",
    pending: "Tasks that still need your attention.",
    completed: "Take a moment to celebrate your progress.",
    overdue: "Tasks whose due dates have passed."
  }[activeFilter];
}

function render() {
  renderStats();
  renderFilters();
  renderTasks();
}

function openCreateDialog() {
  taskForm.reset();
  $("#taskId").value = "";
  $("#taskPriority").value = "Medium";
  $("#dialogTitle").textContent = "Create a task";
  $("#saveTaskBtn").textContent = "Create task";
  taskDialog.showModal();
  $("#taskTitle").focus();
}

function openEditDialog(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;

  $("#taskId").value = task.id;
  $("#taskTitle").value = task.title;
  $("#taskDescription").value = task.description || "";
  $("#taskPriority").value = task.priority || "Medium";
  $("#taskDueDate").value = task.dueDate || "";

  $("#dialogTitle").textContent = "Edit task";
  $("#saveTaskBtn").textContent = "Save changes";

  taskDialog.showModal();
  $("#taskTitle").focus();
}

async function handleSave(event) {
  event.preventDefault();

  if (!taskForm.reportValidity()) return;

  const id = $("#taskId").value;
  const existing = tasks.find((task) => task.id === id);

  const taskData = {
    title: $("#taskTitle").value.trim(),
    description: $("#taskDescription").value.trim(),
    priority: $("#taskPriority").value.toLowerCase(),
    dueDate: $("#taskDueDate").value,
    completed: existing ? existing.completed : false
  };

  if (!taskData.title) {
    $("#taskTitle").focus();
    return;
  }

  try {
    const url = existing
      ? `${API_BASE_URL}/tasks/${encodeURIComponent(id)}`
      : `${API_BASE_URL}/tasks`;

    const response = await fetch(url, {
      method: existing ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(taskData)
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    const data = await response.json();
    const savedTask = data.task;

    const updatedTask = {
      id: savedTask.taskID || savedTask.id || id,
      title: savedTask.title,
      description: savedTask.description || "",
      priority: (savedTask.priority || "medium").charAt(0).toUpperCase()
        + (savedTask.priority || "medium").slice(1),
      dueDate: savedTask.dueDate || "",
      completed: Boolean(savedTask.completed),
      createdAt: Number(savedTask.createdAt) || Date.now()
    };

    tasks = existing
      ? tasks.map((task) => task.id === id ? updatedTask : task)
      : [updatedTask, ...tasks];

    taskDialog.close();
    render();
    showToast(existing ? "Task updated successfully." : "Task created successfully.");
  } catch (error) {
    console.error("AWS save error:", error);
    showToast("Could not save task to AWS. Please try again.");
  }
}

async function toggleTask(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;

  try {
    const response = await fetch(
      `${API_BASE_URL}/tasks/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: task.title,
          description: task.description || "",
          priority: (task.priority || "Medium").toLowerCase(),
          dueDate: task.dueDate || "",
          completed: !task.completed
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    const data = await response.json();
    const savedTask = data.task;

    tasks = tasks.map((item) =>
      item.id === id
        ? {
            ...item,
            completed: Boolean(savedTask.completed)
          }
        : item
    );

    render();
    showToast(
      savedTask.completed
        ? "Great job! Task completed."
        : "Task marked as pending."
    );
  } catch (error) {
    console.error("AWS completion update error:", error);
    showToast("Could not update task in AWS. Please try again.");
  }
}

async function deleteTask(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;

  if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`)) {
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/tasks/${encodeURIComponent(id)}`,
      {
        method: "DELETE"
      }
    );

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    tasks = tasks.filter((item) => item.id !== id);

    render();
    showToast("Task deleted successfully.");
  } catch (error) {
    console.error("AWS delete error:", error);
    showToast("Could not delete task from AWS. Please try again.");
  }
}

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    render();
  });
});

$("#openAddBtn").addEventListener("click", openCreateDialog);
$("#emptyAddBtn").addEventListener("click", openCreateDialog);
$("#closeDialogBtn").addEventListener("click", () => taskDialog.close());
$("#cancelDialogBtn").addEventListener("click", () => taskDialog.close());

taskForm.addEventListener("submit", handleSave);

$("#searchInput").addEventListener("input", (event) => {
  searchQuery = event.target.value.trim();
  renderTasks();
});

$("#sortSelect").addEventListener("change", renderTasks);

taskList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;

  if (action === "toggle") toggleTask(id);
  if (action === "edit") openEditDialog(id);
  if (action === "delete") deleteTask(id);
});

taskDialog.addEventListener("click", (event) => {
  if (event.target === taskDialog) taskDialog.close();
});

$("#todayLabel").textContent = new Date().toLocaleDateString(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric"
}).toUpperCase();
// ===== Light and Dark Mode =====

const themeToggle = document.querySelector("#themeToggle");

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;

  const isDark = theme === "dark";

  themeToggle.textContent = isDark ? "☀️ Light mode" : "🌙 Dark mode";
  themeToggle.setAttribute(
    "aria-label",
    isDark ? "Switch to light mode" : "Switch to dark mode"
  );
}

const savedTheme = localStorage.getItem("taskflow-theme") || "light";
applyTheme(savedTheme);

themeToggle.addEventListener("click", () => {
  const currentTheme = document.documentElement.dataset.theme;
  const nextTheme = currentTheme === "dark" ? "light" : "dark";

  applyTheme(nextTheme);
  localStorage.setItem("taskflow-theme", nextTheme);
});
fetchTasksFromAPI();