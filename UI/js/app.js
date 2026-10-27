const $ = (id) => document.getElementById(id);
let currentFolder = null;
let currentFolderName = "My Drive";
let allFilesMode = false;
let listMode = false;
let searchMode = false;
let searchTimer;

document.addEventListener("DOMContentLoaded", () => {
  $("newFolderBtn").addEventListener("click", openFolderModal);
  $("uploadBtn").addEventListener("click", () => $("fileInput").click());
  $("fileInput").addEventListener("change", uploadSelectedFile);
  $("folderForm").addEventListener("submit", createFolder);
  $("closeModal").addEventListener("click", closeFolderModal);
  $("cancelModal").addEventListener("click", closeFolderModal);
  $("homeBtn").addEventListener("click", () => navigateHome());
  $("allFilesBtn").addEventListener("click", () => loadAllFiles());
  $("gridViewBtn").addEventListener("click", () => setView(false));
  $("listViewBtn").addEventListener("click", () => setView(true));
  $("searchInput").addEventListener("input", () => {
    clearTimeout(searchTimer);
    const q = $("searchInput").value.trim();
    searchTimer = setTimeout(() => q ? search(q) : navigateHome(), 250);
  });
  $("clearSearch").addEventListener("click", () => {
    $("searchInput").value = "";
    navigateHome();
  });
  navigateHome();
});

function showMessage(text, kind = "success") {
  const el = $("message");
  el.textContent = text;
  el.className = `message ${kind}`;
  window.setTimeout(() => el.classList.add("hidden"), 5000);
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
function setView(asList) {
  listMode = asList;
  $("gridViewBtn").classList.toggle("selected", !asList);
  $("listViewBtn").classList.toggle("selected", asList);
  $("folderGrid").classList.toggle("list-mode", asList);
  $("fileGrid").classList.toggle("list-mode", asList);
}
function openFolderModal() {
  $("folderName").value = "";
  $("modal").classList.remove("hidden");
  $("folderName").focus();
}
function closeFolderModal() { $("modal").classList.add("hidden"); }

async function navigateHome() {
  currentFolder = null;
  currentFolderName = "My Drive";
  allFilesMode = false;
  searchMode = false;
  $("pageTitle").textContent = "My Drive";
  $("pageSubtitle").textContent = "Organize your files and folders in one place.";
  $("homeBtn").classList.add("active");
  $("allFilesBtn").classList.remove("active");
  $("folderSection").classList.remove("hidden");
  $("filesTitle").textContent = "Files";
  renderBreadcrumbs();
  await loadContents(null);
}
async function openFolder(folder) {
  currentFolder = folder.id;
  currentFolderName = folder.name || "Folder";
  allFilesMode = false;
  searchMode = false;
  $("pageTitle").textContent = currentFolderName;
  $("pageSubtitle").textContent = "Items in this folder.";
  $("homeBtn").classList.add("active");
  $("allFilesBtn").classList.remove("active");
  $("folderSection").classList.remove("hidden");
  $("filesTitle").textContent = "Files";
  renderBreadcrumbs();
  await loadContents(folder.id);
}
function renderBreadcrumbs() {
  const root = `<button class="crumb ${currentFolder == null ? "current" : ""}" id="rootCrumb">My Drive</button>`;
  $("breadcrumbs").innerHTML = root + (currentFolder != null ? `<span>›</span><span class="crumb current">${escapeHtml(currentFolderName)}</span>` : "");
  $("rootCrumb").addEventListener("click", navigateHome);
}
async function loadContents(folderId) {
  hideEmpty();
  setLoading(true);
  try {
    let folders, files;
    if (folderId == null) {
      const [allFolders, allFiles] = await Promise.all([
        requestJson(API.folders), requestJson(API.files)
      ]);
      folders = (allFolders || []).filter(f => f.parentId == null);
      files = (allFiles || []).filter(f => f.folderId == null);
    } else {
      const [childFolders, childFiles] = await Promise.all([
        requestJson(`${API.folders}/parent/${encodeURIComponent(folderId)}`),
        requestJson(`${API.files}/folder/${encodeURIComponent(folderId)}`)
      ]);
      folders = childFolders || [];
      files = childFiles || [];
    }
    renderFolders(folders);
    renderFiles(files);
    $("sectionTitle").textContent = "Folders";
    $("itemCount").textContent = folders.length ? `(${folders.length})` : "";
    $("fileCount").textContent = files.length ? `(${files.length})` : "";
    if (!folders.length && !files.length) showEmpty(true);
  } catch (error) {
    showMessage(`Could not load items. Check that folder-service (8082) and file-service (8081) are running. ${error.message}`, "error");
  } finally { setLoading(false); }
}
function setLoading(isLoading) {
  if (isLoading) {
    $("folderGrid").innerHTML = "";
    $("fileGrid").innerHTML = "";
  }
}
function renderFolders(folders) {
  $("folderGrid").innerHTML = folders.map(f => `
    <article class="card">
      <div class="card-top"><div class="file-icon folder">📁</div>
        <div class="card-info"><div class="card-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name || "Untitled folder")}</div><div class="card-meta">Folder</div></div>
        <button class="card-menu" data-delete-folder="${escapeHtml(f.id)}" title="Delete folder">⋮</button>
      </div>
      <div class="card-actions"><button class="small-btn" data-open-folder="${escapeHtml(f.id)}">Open folder →</button><button class="small-btn danger" data-delete-folder="${escapeHtml(f.id)}">Delete</button></div>
    </article>`).join("");
  $("folderGrid").querySelectorAll("[data-open-folder]").forEach(btn => {
    btn.addEventListener("click", () => {
      const folder = folders.find(f => String(f.id) === btn.dataset.openFolder);
      if (folder) openFolder(folder);
    });
  });
  $("folderGrid").querySelectorAll("[data-delete-folder]").forEach(btn => btn.addEventListener("click", () => deleteFolder(btn.dataset.deleteFolder)));
}
function renderFiles(files) {
  $("fileGrid").innerHTML = files.map(f => {
    const ext = (f.name || "").split(".").pop().toLowerCase();
    const icon = fileIcon(ext);
    const size = f.size ? formatBytes(f.size) : "File";
    return `<article class="card">
      <div class="card-top"><div class="file-icon ${icon.cls}">${icon.symbol}</div>
        <div class="card-info"><div class="card-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name || "Untitled file")}</div><div class="card-meta">${size}</div></div>
        <button class="card-menu" data-delete-file="${escapeHtml(f.id)}" title="Delete file">⋮</button>
      </div>
      <div class="card-actions"><button class="small-btn" data-download-file="${escapeHtml(f.id)}">↓ Download</button><button class="small-btn danger" data-delete-file="${escapeHtml(f.id)}">Delete</button></div>
    </article>`;
  }).join("");
  $("fileGrid").querySelectorAll("[data-download-file]").forEach(btn => btn.addEventListener("click", () => downloadFile(btn.dataset.downloadFile)));
  $("fileGrid").querySelectorAll("[data-delete-file]").forEach(btn => btn.addEventListener("click", () => deleteFile(btn.dataset.deleteFile)));
}
function fileIcon(ext) {
  if (["png","jpg","jpeg","gif","webp","svg"].includes(ext)) return {symbol:"🖼️",cls:"image"};
  if (ext === "pdf") return {symbol:"📕",cls:"pdf"};
  if (["zip","rar","7z"].includes(ext)) return {symbol:"🗜️",cls:"archive"};
  if (["doc","docx","txt","rtf"].includes(ext)) return {symbol:"📄",cls:""};
  if (["xls","xlsx","csv"].includes(ext)) return {symbol:"📊",cls:"image"};
  if (["ppt","pptx"].includes(ext)) return {symbol:"📽️",cls:"pdf"};
  return {symbol:"📄",cls:""};
}
function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B","KB","MB","GB"];
  const i = Math.min(Math.floor(Math.log(bytes)/Math.log(1024)), units.length-1);
  return `${(bytes/Math.pow(1024,i)).toFixed(i ? 1 : 0)} ${units[i]}`;
}
function showEmpty(show) { $("emptyState").classList.toggle("hidden", !show); }
function hideEmpty() { showEmpty(false); }

async function createFolder(event) {
  event.preventDefault();
  const name = $("folderName").value.trim();
  if (!name) return;
  try {
    const result = await requestJson(`${API.folders}/create`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({name, parentId:currentFolder})
    });
    if (result && result.Success === false) throw new Error(result.error || "Folder creation failed");
    closeFolderModal();
    showMessage(`Folder "${name}" created.`);
    await loadContents(currentFolder);
  } catch (error) { showMessage(`Could not create folder: ${error.message}`, "error"); }
}
async function uploadSelectedFile() {
    const input = document.getElementById("fileInput");
    const file = input.files[0];

    if (!file) {
        alert("Please select a file.");
        return;
    }

    const formData = new FormData();

    formData.append("name", file.name);
    formData.append("file", file);

    if (currentFolder !== null) {
        formData.append("folderId", String(currentFolder));
    }

    try {
        const response = await fetch(
            "http://localhost:8081/api/files/upload",
            {
                method: "POST",
                body: formData
            }
        );

        const result = await response.json();

        if (!response.ok || result.success !== true) {
            throw new Error(result.error || "Upload failed");
        }

        alert("File uploaded successfully!");

        // Refresh your file listing after upload.
        await loadContents(currentFolder);

    } catch (error) {
        console.error("Upload error:", error);
        alert(error.message);
    } finally {
        input.value = "";
    }
}
async function deleteFolder(id) {
  if (!confirm("Delete this folder? The backend deletes the folder record only; it may not delete its contents.")) return;
  try {
    await requestJson(`${API.folders}/${encodeURIComponent(id)}`, {method:"DELETE"});
    showMessage("Folder deleted.");
    await loadContents(currentFolder);
  } catch (error) { showMessage(`Could not delete folder: ${error.message}`, "error"); }
}
async function deleteFile(id) {
  if (!confirm("Delete this file record?")) return;
  try {
    await requestJson(`${API.files}/${encodeURIComponent(id)}`, {method:"DELETE"});
    showMessage("File deleted.");
    await loadContents(currentFolder);
  } catch (error) { showMessage(`Could not delete file: ${error.message}`, "error"); }
}
async function downloadFile(id) {
  try {
    const response = await fetch(`${API.files}/download/${encodeURIComponent(id)}`);
    if (!response.ok || response.status === 204) throw new Error("File not found or download endpoint returned no content.");
    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") || "";
    const match = disposition.match(/filename="?([^";]+)"?/i);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = match ? match[1] : `file-${id}`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  } catch (error) { showMessage(`Download failed: ${error.message}`, "error"); }
}
async function loadAllFiles() {
  currentFolder = null; allFilesMode = true; searchMode = false;
  $("pageTitle").textContent = "All files";
  $("pageSubtitle").textContent = "Every file returned by file-service.";
  $("homeBtn").classList.remove("active"); $("allFilesBtn").classList.add("active");
  $("folderSection").classList.add("hidden"); $("filesTitle").textContent = "All files";
  $("breadcrumbs").innerHTML = `<button class="crumb current" id="allCrumb">All files</button>`;
  $("allCrumb").addEventListener("click", loadAllFiles);
  hideEmpty();
  try {
    const files = await requestJson(API.files);
    renderFiles(files || []);
    $("fileCount").textContent = files?.length ? `(${files.length})` : "";
    showEmpty(!files || !files.length);
  } catch (error) { showMessage(`Could not load files: ${error.message}`, "error"); }
}
async function search(query) {
  searchMode = true; currentFolder = null;
  $("pageTitle").textContent = "Search results";
  $("pageSubtitle").textContent = `Results for “${query}”.`;
  $("folderSection").classList.remove("hidden");
  $("homeBtn").classList.remove("active"); $("allFilesBtn").classList.remove("active");
  $("breadcrumbs").innerHTML = `<span class="crumb current">Search</span>`;
  hideEmpty();
  try {
    const result = await requestJson(`${API.search}?query=${encodeURIComponent(query)}`);
    renderFolders(result.folders || []);
    renderFiles(result.files || []);
    $("sectionTitle").textContent = "Folders";
    $("itemCount").textContent = result.folders?.length ? `(${result.folders.length})` : "";
    $("fileCount").textContent = result.files?.length ? `(${result.files.length})` : "";
    showEmpty(!(result.folders?.length || result.files?.length));
  } catch (error) {
    showMessage(`Search failed. Make sure search-service (8083), file-service (8081), and folder-service (8082) are running. ${error.message}`, "error");
  }
}
