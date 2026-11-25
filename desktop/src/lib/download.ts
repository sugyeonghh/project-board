import { api } from "../api/client";

/**
 * 첨부파일 저장. 윈도우 앱(Tauri)에서는 "다른 이름으로 저장" 창을 띄우고,
 * 브라우저 개발 모드에서는 일반 다운로드로 처리한다.
 */
export async function downloadAttachment(id: number, name: string) {
  const blob = await api.blob(`/attachments/${id}/download`);
  if ("__TAURI_INTERNALS__" in window) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({ defaultPath: name });
    if (!path) return;
    await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
