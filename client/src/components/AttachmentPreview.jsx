import { useEffect, useRef, useState } from "react";
import { deleteTaskImage, getTaskImage, saveTaskImage, taskImageUrl } from "../services/api";

const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
const maxBytes = 5 * 1024 * 1024;

export default function AttachmentPreview({ taskId, onFileChange, disabled = false }) {
  const [stored, setStored] = useState(null);
  const [selected, setSelected] = useState(null);
  const [enabled, setEnabled] = useState(taskId ? null : true);
  const [saving, setSaving] = useState(false);
  const busy = disabled || saving;
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const input = useRef(null);
  const activeUrl = useRef(null);

  useEffect(() => {
    let active = true;
    if (taskId) getTaskImage(taskId).then(({ data }) => {
      if (active) {
        setStored(data.image);
        setEnabled(data.enabled);
      }
    }).catch(() => {
      if (active) {
        setEnabled(false);
        setError("Could not load image attachment.");
      }
    });
    return () => {
      active = false;
      if (activeUrl.current) URL.revokeObjectURL(activeUrl.current);
    };
  }, [taskId]);

  function discard() {
    if (activeUrl.current) URL.revokeObjectURL(activeUrl.current);
    activeUrl.current = null;
    setSelected(null);
    onFileChange?.(null);
    setError("");
  }

  function choose(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setNotice("");
    if (!allowedTypes.includes(file.type)) {
      setError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (!file.size || file.size > maxBytes) {
      setError(file.size ? "This image exceeds 5 MB. Choose a smaller file." : "This file is empty. Choose another image.");
      return;
    }
    discard();
    activeUrl.current = URL.createObjectURL(file);
    setSelected({ file, url: activeUrl.current });
    onFileChange?.(file);
  }

  async function upload() {
    setError("");
    setSaving(true);
    try {
      const { data } = await saveTaskImage(taskId, selected.file);
      setStored(data.image);
      discard();
      setNotice("Image saved.");
    } catch (err) {
      setError(err.response?.data?.message || "Could not upload the image.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setError("");
    setNotice("");
    setSaving(true);
    try {
      await deleteTaskImage(taskId);
      setStored(null);
      setNotice("Image removed.");
    } catch (err) {
      setError(err.response?.data?.message || "Could not remove the image.");
    } finally {
      setSaving(false);
    }
  }

  const file = selected?.file ?? stored;
  const filename = selected?.file.name ?? stored?.filename;
  const src = selected?.url ?? (stored && taskImageUrl(taskId, stored.id));

  return (
    <aside className="planner-panel attachment-panel" aria-labelledby="attachment-title">
      <h2 id="attachment-title">Image attachment</h2>
      <p>Optional · One JPEG, PNG, or WebP image up to 5 MB.</p>
      {enabled === null && <p>Loading attachment…</p>}
      {enabled === false && !error && <p>Image storage is disabled.</p>}
      <input ref={input} type="file" accept={allowedTypes.join(",")} hidden onChange={choose} />
      {file && <>
        <div className="attachment-file">
          <div><strong>{filename}</strong><p>{Math.max(1, Math.round(file.size / 1024))} KB</p></div>
          <button type="button" className="secondary danger-text" disabled={busy}
            onClick={selected ? discard : remove}>{selected ? "Discard preview" : "Remove"}</button>
        </div>
        <img src={src} alt={selected ? "Selected attachment preview" : "Saved task attachment"} onError={() => {
          if (selected) discard();
          setError("This image could not be opened. Choose another image.");
        }} />
      </>}
      {enabled && <div className="button-row">
        <button type="button" className="secondary" disabled={busy} onClick={() => input.current.click()}>
          {file ? "Choose another image" : "Choose image"}
        </button>
        {selected && taskId && <button type="button" onClick={upload} disabled={busy}>{saving ? "Uploading…" : "Upload image"}</button>}
      </div>}
      {selected && <p>{taskId ? "Use Upload image to save this attachment." : "This image will be uploaded when you create the task."}</p>}
      {notice && <p role="status">{notice}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </aside>
  );
}
