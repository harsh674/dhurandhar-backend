require("dotenv").config();

const required = ["MONGO_URI", "JWT_SECRET"];
for (const k of required) {
  if (!process.env[k]) {
    // eslint-disable-next-line no-console
    console.warn(`[env] Warning: ${k} is not set — falling back to defaults where possible.`);
  }
}

module.exports = {
  port: parseInt(process.env.PORT || "5000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/serviq",
  jwtSecret: process.env.JWT_SECRET || "dev-only-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  corsOrigins: (process.env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean),
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  whatsapp: {
    token: process.env.WHATSAPP_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "serviq-verify-token",
    apiVersion: process.env.WHATSAPP_API_VERSION || "v21.0",
  },
};
