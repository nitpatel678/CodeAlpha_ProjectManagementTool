// Global state
let currentUser = null;
let currentProject = null;
let currentTask = null;
let isLogin = true;

// Initialize app
document.addEventListener("DOMContentLoaded", function () {
  // Check if user is logged in
  const token = localStorage.getItem("token");
  if (token) {
    currentUser = JSON.parse(localStorage.getItem("user"));
    document.getElementById("authModal").style.display = "none";
    loadProjects();
    loadNotifications();
    startNotificationPolling();
  }

  // Auth form handling
  document.getElementById("authForm").addEventListener("submit", handleAuth);
  document
    .getElementById("authSwitch")
    .addEventListener("click", toggleAuthMode);

  // Project form handling
  document
    .getElementById("projectForm")
    .addEventListener("submit", createProject);
  document
    .getElementById("taskForm")
    .addEventListener("submit", handleTaskSubmit);

  // Notification dropdown
  document
    .getElementById("notificationBadge")
    .addEventListener("click", toggleNotificationDropdown);

  // Close dropdowns when clicking outside
  document.addEventListener("click", function (e) {
    if (!e.target.closest("#notificationBadge")) {
      document.getElementById("notificationDropdown").style.display = "none";
    }
  });
});

// Authentication
async function handleAuth(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);

  const endpoint = isLogin ? "login" : "register";

  try {
    const response = await fetch(`/api/auth/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (response.ok) {
      currentUser = result.user;
      localStorage.setItem("token", result.token);
      localStorage.setItem("user", JSON.stringify(result.user));

      document.getElementById("authModal").style.display = "none";
      document.getElementById(
        "welcomeUser"
      ).textContent = `Welcome, ${currentUser.username}!`;

      loadProjects();
      loadNotifications();
      startNotificationPolling();
    } else {
      alert(result.message || "Authentication failed");
    }
  } catch (error) {
    console.error("Auth error:", error);
    alert("Network error. Please try again.");
  }
}

function toggleAuthMode() {
  isLogin = !isLogin;
  const title = document.getElementById("authTitle");
  const submit = document.getElementById("authSubmit");
  const switchText = document.getElementById("authSwitch");
  const emailGroup = document.getElementById("email").parentElement;

  if (isLogin) {
    title.textContent = "Sign In to ProjectHub";
    submit.textContent = "Sign In";
    switchText.textContent = "Don't have an account? Sign up";
    emailGroup.style.display = "none";
  } else {
    title.textContent = "Create Account";
    submit.textContent = "Sign Up";
    switchText.textContent = "Already have an account? Sign in";
    emailGroup.style.display = "block";
  }

  document.getElementById("authForm").reset();
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  currentUser = null;
  currentProject = null;
  document.getElementById("authModal").style.display = "flex";
  showProjectBoard();
}

// Projects
async function loadProjects() {
  try {
    const response = await fetch("/api/projects", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    const projects = await response.json();
    displayProjects(projects);
  } catch (error) {
    console.error("Error loading projects:", error);
  }
}

function displayProjects(projects) {
  const grid = document.getElementById("projectsGrid");
  grid.innerHTML = "";

  projects.forEach((project) => {
    const projectCard = document.createElement("div");
    projectCard.className = "project-card";
    projectCard.onclick = () => openProject(project);

    projectCard.innerHTML = `
                    <h3>${project.name}</h3>
                    <p class="project-description">${
                      project.description || "No description"
                    }</p>
                    <div class="project-stats">
                        <span>Tasks: ${project.taskCount || 0}</span>
                        <span>Members: ${project.members.length}</span>
                    </div>
                `;

    grid.appendChild(projectCard);
  });
}

function openProject(project) {
  currentProject = project;
  document.getElementById("currentProjectTitle").textContent = project.name;
  document.getElementById("projectBoard").style.display = "none";
  document.getElementById("taskBoard").style.display = "block";
  loadTasks(project._id);
  loadProjectMembers(project);
}

function showProjectBoard() {
  document.getElementById("taskBoard").style.display = "none";
  document.getElementById("projectBoard").style.display = "block";
  currentProject = null;
  currentTask = null;
}

async function createProject(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);

  // Parse members from comma-separated string
  data.members = data.projectMembers
    ? data.projectMembers.split(",").map((email) => email.trim())
    : [];

  try {
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({
        name: data.projectName,
        description: data.projectDescription,
        members: data.members,
      }),
    });

    if (response.ok) {
      closeModal("projectModal");
      loadProjects();
      e.target.reset();
    } else {
      const error = await response.json();
      alert(error.message || "Failed to create project");
    }
  } catch (error) {
    console.error("Error creating project:", error);
    alert("Network error. Please try again.");
  }
}

// Tasks
async function loadTasks(projectId) {
  try {
    const response = await fetch(`/api/projects/${projectId}/tasks`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    const tasks = await response.json();
    displayTasks(tasks);
  } catch (error) {
    console.error("Error loading tasks:", error);
  }
}

function displayTasks(tasks) {
  // Clear all task columns
  ["todoTasks", "inprogressTasks", "doneTasks"].forEach((columnId) => {
    document.getElementById(columnId).innerHTML = "";
  });

  tasks.forEach((task) => {
    const taskCard = createTaskCard(task);
    const columnId =
      task.status === "todo"
        ? "todoTasks"
        : task.status === "inprogress"
        ? "inprogressTasks"
        : "doneTasks";

    document.getElementById(columnId).appendChild(taskCard);
  });
}

function createTaskCard(task) {
  const taskCard = document.createElement("div");
  taskCard.className = "task-card";
  taskCard.onclick = () => openTaskModal(task);

  const priorityClass = `priority-${task.priority}`;
  const assigneeName = task.assignee ? task.assignee.username : "Unassigned";

  taskCard.innerHTML = `
                <div class="task-title">${task.title}</div>
                <div class="task-description">${
                  task.description || "No description"
                }</div>
                <div class="task-meta">
                    <div class="task-assignee">${assigneeName}</div>
                    <div class="task-priority ${priorityClass}">${task.priority.toUpperCase()}</div>
                </div>
            `;

  return taskCard;
}

async function loadProjectMembers(project) {
  const assigneeSelect = document.getElementById("taskAssignee");
  assigneeSelect.innerHTML = '<option value="">Select assignee</option>';

  // Add current user and project members
  const members = [
    currentUser,
    ...project.members.filter((m) => m._id !== currentUser._id),
  ];

  members.forEach((member) => {
    const option = document.createElement("option");
    option.value = member._id;
    option.textContent = member.username;
    assigneeSelect.appendChild(option);
  });
}

async function handleTaskSubmit(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);

  const taskData = {
    title: data.taskTitle,
    description: data.taskDescription,
    assignee: data.taskAssignee,
    priority: data.taskPriority,
    status: data.taskStatus,
  };

  try {
    const url = currentTask
      ? `/api/projects/${currentProject._id}/tasks/${currentTask._id}`
      : `/api/projects/${currentProject._id}/tasks`;
    const method = currentTask ? "PUT" : "POST";

    const response = await fetch(url, {
      method: method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify(taskData),
    });

    if (response.ok) {
      closeModal("taskModal");
      loadTasks(currentProject._id);
      e.target.reset();
      currentTask = null;
    } else {
      const error = await response.json();
      alert(error.message || "Failed to save task");
    }
  } catch (error) {
    console.error("Error saving task:", error);
    alert("Network error. Please try again.");
  }
}

function openTaskModal(task = null) {
  currentTask = task;
  const modal = document.getElementById("taskModal");
  const title = document.getElementById("taskModalTitle");
  const form = document.getElementById("taskForm");
  const commentsSection = document.getElementById("commentsSection");
  const submitBtn = form.querySelector('button[type="submit"]');

  if (task) {
    title.textContent = "Task Details";
    document.getElementById("taskTitle").value = task.title;
    document.getElementById("taskDescription").value = task.description || "";
    document.getElementById("taskAssignee").value = task.assignee
      ? task.assignee._id
      : "";
    document.getElementById("taskPriority").value = task.priority;
    document.getElementById("taskStatus").value = task.status;

    commentsSection.classList.remove("hidden");
    loadComments(task._id);

    // 🔹 Only task creator can edit
    const canEdit = task.createdBy && task.createdBy._id === currentUser._id;
    Array.from(form.elements).forEach((el) => (el.disabled = !canEdit));
    submitBtn.style.display = canEdit ? "block" : "none";
  } else {
    title.textContent = "Create New Task";
    form.reset();
    commentsSection.classList.add("hidden");

    // Enable form for new task
    Array.from(form.elements).forEach((el) => (el.disabled = false));
    submitBtn.style.display = "block";
  }

  modal.style.display = "flex";
}

// Comments
async function loadComments(taskId) {
  try {
    const response = await fetch(`/api/tasks/${taskId}/comments`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    const comments = await response.json();
    displayComments(comments);
  } catch (error) {
    console.error("Error loading comments:", error);
  }
}

function displayComments(comments) {
  const commentsList = document.getElementById("commentsList");
  commentsList.innerHTML = "";

  comments.forEach((comment) => {
    const commentDiv = document.createElement("div");
    commentDiv.className = "comment";
    commentDiv.innerHTML = `
                    <div class="comment-author">${comment.author.username}</div>
                    <div class="comment-text">${comment.text}</div>
                    <small style="color: #a0aec0;">${new Date(
                      comment.createdAt
                    ).toLocaleString()}</small>
                `;
    commentsList.appendChild(commentDiv);
  });
}

async function addComment() {
  const input = document.getElementById("commentInput");
  const text = input.value.trim();

  if (!text || !currentTask) return;

  try {
    const response = await fetch(`/api/tasks/${currentTask._id}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ text }),
    });

    if (response.ok) {
      input.value = "";
      loadComments(currentTask._id);
    } else {
      const error = await response.json();
      alert(error.message || "Failed to add comment");
    }
  } catch (error) {
    console.error("Error adding comment:", error);
    alert("Network error. Please try again.");
  }
}

// Notifications
async function loadNotifications() {
  try {
    const response = await fetch("/api/notifications", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    const notifications = await response.json();
    displayNotifications(notifications);
  } catch (error) {
    console.error("Error loading notifications:", error);
  }
}

function displayNotifications(notifications) {
  const badge = document.getElementById("notificationCount");
  const list = document.getElementById("notificationList");

  const unreadCount = notifications.filter((n) => !n.read).length;
  badge.textContent = unreadCount;
  badge.style.display = unreadCount > 0 ? "flex" : "none";

  list.innerHTML = "";

  if (notifications.length === 0) {
    list.innerHTML = '<div class="notification-item">No notifications</div>';
    return;
  }

  notifications.forEach((notification) => {
    const item = document.createElement("div");
    item.className = `notification-item ${notification.read ? "" : "unread"}`;
    item.onclick = () => markNotificationAsRead(notification._id);

    item.innerHTML = `
                    <div style="font-weight: 600; margin-bottom: 5px;">${
                      notification.title
                    }</div>
                    <div style="font-size: 14px; color: #718096;">${
                      notification.message
                    }</div>
                    <small style="color: #a0aec0;">${new Date(
                      notification.createdAt
                    ).toLocaleString()}</small>
                `;

    list.appendChild(item);
  });
}

async function markNotificationAsRead(notificationId) {
  try {
    await fetch(`/api/notifications/${notificationId}/read`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    loadNotifications();
  } catch (error) {
    console.error("Error marking notification as read:", error);
  }
}

function toggleNotificationDropdown() {
  const dropdown = document.getElementById("notificationDropdown");
  dropdown.style.display =
    dropdown.style.display === "block" ? "none" : "block";
}

function startNotificationPolling() {
  // Poll for new notifications every 30 seconds
  setInterval(loadNotifications, 30000);
}

// Modal functions
function openProjectModal() {
  document.getElementById("projectModal").style.display = "flex";
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = "none";
  if (modalId === "taskModal") {
    currentTask = null;
  }
}

// Close modal when clicking outside
window.onclick = function (event) {
  if (event.target.classList.contains("modal")) {
    event.target.style.display = "none";
    if (event.target.id === "taskModal") {
      currentTask = null;
    }
  }
};
