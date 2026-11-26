export default function SubtaskProgress({ completed, total }) {
  if (total === 0) return null;

  const percent = Math.floor((completed * 100) / total);
  return (
    <div className="subtask-progress">
      <span>Subtasks: {completed}/{total} ({percent}%)</span>
      <progress aria-label="Subtask completion" value={completed} max={total} />
    </div>
  );
}
