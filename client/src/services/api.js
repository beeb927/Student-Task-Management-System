import axios from "axios";

export const API_BASE_URL = import.meta.env.MODE === "mobile" && import.meta.env.DEV
  ? "/api"
  : import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // REQUIRED so the browser sends/receives the cookie
});

// Auth
export const registerUser = (userData) => api.post("/auth/register", userData);
export const loginUser = (userData) => api.post("/auth/login", userData);
export const logoutUser = () => api.post("/auth/logout");
export const getCurrentUser = () => api.get("/auth/me");

// Tasks
export const getTasks = () => api.get("/tasks");
export const getTask = (id) => api.get(`/tasks/${id}`);
export const createTask = (taskData) => api.post("/tasks", taskData);
export const updateTask = (id, taskData) => api.put(`/tasks/${id}`, taskData);
export const setTaskStatus = (id, status) => api.patch(`/tasks/${id}/status`, { status });
export const deleteTask = (id) => api.delete(`/tasks/${id}`);
export const clearCompletedTasks = () => api.delete("/tasks/completed");

// Courses
export const getCourses = () => api.get("/courses");
export const createCourse = (data) => api.post("/courses", data);
export const updateCourse = (id, data) => api.put(`/courses/${id}`, data);
export const deleteCourse = (id) => api.delete(`/courses/${id}`);

// Class schedule
export const getClasses = () => api.get("/schedule");
export const createClass = (data) => api.post("/schedule", data);
export const updateClass = (id, data) => api.put(`/schedule/${id}`, data);
export const deleteClass = (id) => api.delete(`/schedule/${id}`);

// Google sign-in + Google Calendar
// (login/connect are full-page redirects to Google, so they are plain links, not axios calls)
export const getGoogleStatus = () => api.get("/google/status");
export const getGoogleEvents = (timeMin, timeMax) =>
  api.get("/google/events", { params: { timeMin, timeMax } });
export const disconnectGoogle = () => api.post("/google/disconnect");

// Checklist helpers
export const getChecklist = (taskId) => api.get(`/tasks/${taskId}/checklist`);
export const addChecklistItem = (taskId, title) => api.post(`/tasks/${taskId}/checklist`, { title });
export const updateChecklistItem = (taskId, itemId, changes) => api.patch(`/tasks/${taskId}/checklist/${itemId}`, changes);
export const deleteChecklistItem = (taskId, itemId) => api.delete(`/tasks/${taskId}/checklist/${itemId}`);

export default api;

export const getSleepLogs = (from, to) => api.get("/sleep", { params: { from, to } });
export const saveSleepLog = (date, minutes) => api.put(`/sleep/${date}`, { minutes });
export const deleteSleepLog = (date) => api.delete(`/sleep/${date}`);

export const getStudyPlan = () => api.get("/study-sessions");
export const saveStudyPlan = (plan) => api.put("/study-sessions/plan", plan);
export const checkInStudySession = (id, status, minutes) => api.patch(`/study-sessions/${id}`, { status, minutes });

export const getTaskImage = (id) => api.get(`/tasks/${id}/image`);
export const saveTaskImage = (id, file) => api.put(`/tasks/${id}/image`, file, {
  headers: { "Content-Type": "application/octet-stream" },
  params: { filename: file.name },
});
export const deleteTaskImage = (id) => api.delete(`/tasks/${id}/image`);

export const taskImageUrl = (taskId, imageId) =>
  `${API_BASE_URL}/tasks/${taskId}/image/content/${imageId}`;
