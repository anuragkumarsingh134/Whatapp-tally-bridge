function getTaskPriority(task) {
  if (task.priority && Number(task.priority) >= 1 && Number(task.priority) <= 3) {
    return Number(task.priority);
  }

  const fileName = String(task.fileName || '').toLowerCase();
  const fileUrl = String(task.fileUrl || task.url || '').toLowerCase();
  const localPath = String(task.localPath || '').toLowerCase();

  // Priority 1: PDF Document
  if (task.type === 'pdf' || fileName.endsWith('.pdf') || fileUrl.includes('.pdf') || localPath.endsWith('.pdf')) {
    return 1;
  }

  // Priority 2: Text Message
  if (task.type === 'text' || (task.message && !task.fileName && !task.fileUrl && !task.localPath)) {
    return 2;
  }

  // Priority 3: Photos, images, stamped graphics
  return 3;
}

function getPriorityLabel(priority) {
  if (priority === 1) return 'PDF (Priority 1)';
  if (priority === 2) return 'Text (Priority 2)';
  return 'Photo (Priority 3)';
}

module.exports = {
  getTaskPriority,
  getPriorityLabel
};

