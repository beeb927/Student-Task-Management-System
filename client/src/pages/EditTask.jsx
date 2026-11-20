import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AttachmentPreview from "../components/AttachmentPreview";
import TaskForm from "../components/TaskForm";
import { getCourses, getTask, updateTask } from "../services/api";
import { toInputDateTime } from "../utils/taskUtils";

function EditTask() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [initial, setInitial] = useState(null);
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getTask(id), getCourses()])
      .then(([t, c]) => {
        const task = t.data.task;
        setCourses(c.data.courses);
        setInitial({
          title: task.title,
          description: task.description || "",
          dueDate: toInputDateTime(task.due_date),
          priority: task.priority,
          estimatedHours: task.estimated_hours ?? "",
          courseId: task.course_id ?? "",
          completed: task.status === "Complete",
        });
      })
      .catch((err) => setError(err.response?.data?.message || "Could not load task."));
  }, [id]);

  return (
    <>
      <header className="planner-edit-heading">
        <Link to="/dashboard">← Dashboard</Link>
        <h1>Edit Task</h1>
      </header>
      {error && <p className="error">{error}</p>}
      {!initial && !error && <p>Loading...</p>}
      {initial && (
        <TaskForm
          key={id}
          initial={initial}
          sidePanel={<AttachmentPreview key={id} taskId={id} />}
          courses={courses}
          showStatus
          submitLabel="Save Changes"
          onSubmit={async (data) => {
            await updateTask(id, data);
            navigate("/dashboard");
          }}
        />
      )}
    </>
  );
}

export default EditTask;
