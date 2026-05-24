const multer = require('multer');
const path = require('path');
const fs = require('fs');

const ensureDir = (p) => { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); };

// Multer storage — keeps the original extension
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const taskId = req.params.taskId || req.body.taskId || 'general';
    const noteType = req.params.noteType || req.body.noteType || 'misc';
    const dir = path.join(__dirname, `../../uploads/voice/tasks/${taskId}`);
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const noteType = req.params.noteType || req.body.noteType || 'note';
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `${noteType}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.webm', '.mp3', '.ogg', '.wav', '.m4a'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext) || file.mimetype.startsWith('audio/')) {
    cb(null, true);
  } else {
    cb(new Error('Only audio files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
});

// POST /api/upload/voice/:taskId/:noteType
// Returns: { filePath: '/uploads/voice/tasks/{taskId}/{noteType}.webm' }
exports.uploadVoiceNote = [
  upload.single('voice'),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No audio file uploaded' });
    }

    const taskId   = req.params.taskId || req.body.taskId || 'general';
    const noteType = req.params.noteType || req.body.noteType || 'note';
    const ext = path.extname(req.file.originalname) || '.webm';
    const filePath = `/uploads/voice/tasks/${taskId}/${noteType}${ext}`;

    res.json({ success: true, filePath });
  }
];

// GET /api/files/voice/tasks/:taskId/:filename   — JWT-authenticated static serve
exports.serveVoiceFile = (req, res) => {
  const { taskId, filename } = req.params;

  // Sanitize path to prevent directory traversal
  const safeName  = path.basename(filename);
  const safeId    = path.basename(taskId);
  const filePath  = path.resolve(__dirname, `../../uploads/voice/tasks/${safeId}/${safeName}`);

  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ success: false, message: 'Voice file not found' });
  }
};

// --- IMAGE UPLOADS --- //
const imgStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const taskId = req.params.taskId || 'general';
    const dir = path.join(__dirname, `../../uploads/images/tasks/${taskId}`);
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `attachment-${Date.now()}${ext}`);
  }
});
const imgFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  if (allowed.includes(ext) || file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};
const uploadImageMulter = multer({ storage: imgStorage, fileFilter: imgFilter, limits: { fileSize: 20 * 1024 * 1024 } });

exports.uploadImage = [
  uploadImageMulter.single('image'),
  (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image file uploaded' });
    const taskId = req.params.taskId || 'general';
    const filePath = `/uploads/images/tasks/${taskId}/${req.file.filename}`;
    res.json({ success: true, filePath });
  }
];

exports.serveImageFile = (req, res) => {
  const { taskId, filename } = req.params;
  const safeName  = path.basename(filename);
  const safeId    = path.basename(taskId);
  const filePath  = path.resolve(__dirname, `../../uploads/images/tasks/${safeId}/${safeName}`);
  if (fs.existsSync(filePath)) res.sendFile(filePath);
  else res.status(404).json({ success: false, message: 'Image file not found' });
};

// --- AUTHENTICATED SENSITIVE FILE SERVERS --- //

exports.serveReceiptFile = (req, res) => {
  const safeName = path.basename(req.params.filename);
  const filePath = path.resolve(__dirname, `../../uploads/receipts/${safeName}`);
  if (fs.existsSync(filePath)) res.sendFile(filePath);
  else res.status(404).json({ success: false, message: 'Receipt not found' });
};

exports.serveInvoiceFile = (req, res) => {
  const safeName = path.basename(req.params.filename);
  const filePath = path.resolve(__dirname, `../../uploads/invoices/${safeName}`);
  if (fs.existsSync(filePath)) res.sendFile(filePath);
  else res.status(404).json({ success: false, message: 'Invoice not found' });
};

exports.servePurchaseOrderFile = (req, res) => {
  const safeName = path.basename(req.params.filename);
  const filePath = path.resolve(__dirname, `../../uploads/purchase-orders/${safeName}`);
  if (fs.existsSync(filePath)) res.sendFile(filePath);
  else res.status(404).json({ success: false, message: 'Purchase order not found' });
};
