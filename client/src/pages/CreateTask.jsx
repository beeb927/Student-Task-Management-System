import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AttachmentPreview from "../components/AttachmentPreview";
import TaskForm from "../components/TaskForm";
import { createTask, getCourses, saveTaskImage } from "../services/api";

const EMPTY = {
  title: "", description: "", dueDate: "", priority: "Medium",
  estimatedHours: "", courseId: "", completed: false,
};

function CreateTask() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [createdId, setCreatedId] = useState(null);
  const [courses, setCourses] = useState(null);

  useEffect(() => {
    getCourses().then((r) => setCourses(r.data.courses)).catch(() => setCourses([]));
  }, []);

  return (
    <div className="planner-section">
      <h2>Create Task</h2>
      {courses === null ? (
        <p>Loading...</p>
      ) : (
        <TaskForm
          initial={EMPTY}
          courses={courses}
          lockFields={createdId !== null}
          sidePanel={(saving) => <AttachmentPreview onFileChange={setFile} disabled={saving} />}
          submitLabel={createdId ? (file ? "Retry image upload" : "Done") : "Create Task"}
          onSubmit={async (data) => {
            const taskId = createdId ?? (await createTask(data)).data.taskId;
            if (file) {
              try {
                await saveTaskImage(taskId, file);
              } catch (err) {
                setCreatedId(taskId);
                const reason = err.response?.data?.message;
                throw new Error(`Task created. The image could not be uploaded. ${reason ?? "Try uploading again."}`, { cause: err });
              }
            }
            navigate("/dashboard");
          }}
        />
      )}
    </div>
  );
}

export default CreateTask;
