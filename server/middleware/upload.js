const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");
const env = require("../config/env");

let storage;
if (env.cloudinary.cloudName) {
  storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: "serviq/bookings",
      resource_type: "auto",
      transformation: [{ quality: "auto", fetch_format: "auto" }],
    },
  });
} else {
  // Local fallback for dev when Cloudinary creds aren't set.
  storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, "server/uploads"),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  });
}

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024, files: 6 }, // 25 MB / 6 files
  fileFilter: (_req, file, cb) => {
    if (/^(image|video)\//.test(file.mimetype)) cb(null, true);
    else cb(new Error("Only image/video uploads are allowed"));
  },
});

module.exports = upload;
