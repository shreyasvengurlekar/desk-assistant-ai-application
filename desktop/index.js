const panel = document.getElementById("updatePanel");
const status = document.getElementById("updateStatus");
const progress = document.getElementById("updateProgress");

window.updateEvents.onChecking(() => {
  panel.style.display = "block";
  status.innerText = "Checking for updates...";
});

window.updateEvents.onAvailable(() => {
  status.innerText = "Downloading update...";
});

window.updateEvents.onProgress((event, p) => {
  progress.value = p.percent;
});

window.updateEvents.onReady(() => {
  status.innerText = "Update ready. Restart to install.";
});
window.addEventListener("DOMContentLoaded", () => {
  console.log("✅ Renderer loaded");
});