
const STORAGE_KEY = "taskflow-student-tasks-v1";

const $ = (selector) => document.querySelector(selector);

const taskList = $("#taskList");
const emptyState = $("#emptyState");
const taskDialog = $("#taskDialog");
const taskForm = $("#taskForm");
const toast = $("#toast");

let activeFilter = "all";
let searchQuery = "";
let tasks = loadTasks();
let toastTimeout;

function loadTasks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed.filter(isValidTask) : [];
  } catch {
    return [];
  }
}

function isValidTask(task) {
  return task &&
    typeof task.id === "string" &&
    typeof task.title === "string" &&
    typeof task.completed === "boolean";
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return true;
  } catch {
    showToast("Could not save data in this browser.");
    return false;
  }
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

function handleSave(event) {
  event.preventDefault();

  if (!taskForm.reportValidity()) return;

  const id = $("#taskId").value;
  const existing = tasks.find((task) => task.id === id);

  const taskData = {
    id: id || crypto.randomUUID(),
    title: $("#taskTitle").value.trim(),
    description: $("#taskDescription").value.trim(),
    priority: $("#taskPriority").value,
    dueDate: $("#taskDueDate").value,
    completed: existing ? existing.completed : false,
    createdAt: existing ? existing.createdAt : Date.now()
  };

  if (!taskData.title) {
    $("#taskTitle").focus();
    return;
  }

  const previousTasks = tasks;

  tasks = existing
    ? tasks.map((task) => task.id === id ? taskData : task)
    : [taskData, ...tasks];

  if (!saveTasks()) {
    tasks = previousTasks;
    return;
  }

  taskDialog.close();
  render();
  showToast(existing ? "Task updated successfully." : "Task created successfully.");
}

function toggleTask(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;

  const previousTasks = tasks;
  tasks = tasks.map((item) =>
    item.id === id ? { ...item, completed: !item.completed } : item
  );

  if (!saveTasks()) {
    tasks = previousTasks;
    return;
  }

  render();
  showToast(task.completed ? "Task marked as pending." : "Great job! Task completed.");
}

function deleteTask(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;

  if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`)) return;

  const previousTasks = tasks;
  tasks = tasks.filter((item) => item.id !== id);

  if (!saveTasks()) {
    tasks = previousTasks;
    return;
  }

  render();
  showToast("Task deleted.");
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

render();
