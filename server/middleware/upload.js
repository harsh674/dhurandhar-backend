const multer = require("multer");
const cloudinary = require("../config/cloudinary");
const env = require("../config/env");

// Use Cloudinary (v2) when configured; otherwise fall back to disk storage.
const limits = { fileSize: 25 * 1024 * 1024, files: 6 };

// If Cloudinary is configured, use memory storage and upload files in middleware.
if (env.cloudinary.cloudName) {
  const storage = multer.memoryStorage();
  const multerInstance = multer({
    storage,
    limits,
    fileFilter: (_req, file, cb) => {
      if (/^(image|video)\//.test(file.mimetype)) cb(null, true);
      else cb(new Error("Only image/video uploads are allowed"));
    },
  });

  // Provide .array(field, max) compatible function used by routes.
  const upload = {
    array(field, max) {
      const multerMiddleware = multerInstance.array(field, max);
      return (req, res, next) => {
        multerMiddleware(req, res, async (err) => {
          if (err) return next(err);
          if (!req.files || !req.files.length) return next();
          try {
            const uploads = await Promise.all(
              req.files.map((f) =>
                new Promise((resolve, reject) => {
                  const stream = cloudinary.uploader.upload_stream(
                    {
                      folder: "serviq/bookings",
                      resource_type: "auto",
                      transformation: [{ quality: "auto", fetch_format: "auto" }],
                    },
                    (error, result) => {
                      if (error) return reject(error);
                      resolve(result);
                    }
                  );
                  stream.end(f.buffer);
                })
              )
            );

            // Map Cloudinary results back onto req.files for downstream code.
            req.files = req.files.map((orig, i) => ({
              ...orig,
              path: uploads[i].secure_url || uploads[i].url,
              secure_url: uploads[i].secure_url,
              public_id: uploads[i].public_id,
              filename: uploads[i].public_id,
            }));
            return next();
          } catch (e) {
            return next(e);
          }
        });
      };
    },
  };

  module.exports = upload;
} else {
  // Local fallback for dev when Cloudinary creds aren't set.
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, "server/uploads"),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  });
  const upload = multer({
    storage,
    limits,
    fileFilter: (_req, file, cb) => {
      if (/^(image|video)\//.test(file.mimetype)) cb(null, true);
      else cb(new Error("Only image/video uploads are allowed"));
    },
  });
  module.exports = upload;
}
