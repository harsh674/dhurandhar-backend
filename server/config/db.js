const mongoose = require("mongoose");
const env = require("./env");

// Cached connection for serverless (Vercel) cold starts.
let cached = global._serviqMongo;
if (!cached) cached = global._serviqMongo = { conn: null, promise: null };

async function connectDB() {
  if (cached.conn) return cached.conn;

  mongoose.set("strictQuery", true);

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(env.mongoUri, {
        autoIndex: env.nodeEnv !== "production",
        serverSelectionTimeoutMS: 10000,
        maxPoolSize: 10,
      })
      .then((m) => {
        // eslint-disable-next-line no-console
        console.log(`[db] Connected to MongoDB (${env.nodeEnv})`);
        return m;
      })
      .catch((err) => {
        cached.promise = null;
        throw err;
      });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = { connectDB };
