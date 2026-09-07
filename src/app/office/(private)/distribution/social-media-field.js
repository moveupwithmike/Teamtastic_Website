"use client";

import { useState } from "react";
import { uploadSocialMedia } from "@/app/office/actions";

export default function SocialMediaField({ name = "media_paths", initial = [], accept = "image/*,video/*,.pdf,.ppt,.pptx,.doc,.docx" }) {
  const [media, setMedia] = useState(Array.isArray(initial) ? initial : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await uploadSocialMedia(formData);
      if (!result?.ok) {
        setError(result?.error || "media_upload_failed");
        return;
      }
      setMedia((current) => [...current, { bucket: result.bucket, path: result.path, mime: result.mime, kind: result.kind }]);
    } catch {
      setError("media_upload_failed");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  function remove(index) {
    setMedia((current) => current.filter((_, i) => i !== index));
  }

  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(media)} />
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {(media || []).map((item, index) => (
          <button type="button" key={`${item.path}-${index}`} onClick={() => remove(index)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200 hover:border-red-400">
            {item.kind} · {item.path.split("/").pop()}
          </button>
        ))}
        <label className="cursor-pointer rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:border-purple-400">
          {busy ? "Uploading…" : media.length ? "+ Add media" : "+ Attach media"}
          <input type="file" accept={accept} onChange={handleFile} className="sr-only" />
        </label>
      </div>
      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
      {!media.length && <p className="mt-1 text-xs text-slate-500">Attach one or more images, a video, or a document. Required before approval for image/document/video formats.</p>}
    </div>
  );
}