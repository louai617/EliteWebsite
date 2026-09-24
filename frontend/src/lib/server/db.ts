import 'server-only';
import mongoose from 'mongoose';

/**
 * Single shared MongoDB connection.
 *
 * Next.js re-evaluates modules on every hot reload in development and may run
 * many route handlers concurrently, so the connection (and the in-flight
 * connection promise) is cached on `globalThis`. Every request reuses the same
 * pool instead of opening a new one.
 *
 * MONGODB_URI is read here, on the server, only. It has no NEXT_PUBLIC_ prefix,
 * so Next.js never inlines it into a client bundle, and `server-only` makes the
 * build fail if a client component ever imports this file.
 */

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

const globalForMongoose = globalThis as typeof globalThis & { __eliteMongoose?: MongooseCache };
const cache: MongooseCache = globalForMongoose.__eliteMongoose ?? { conn: null, promise: null };
globalForMongoose.__eliteMongoose = cache;

// Drop filter keys that are not in the schema instead of passing them to MongoDB.
mongoose.set('strictQuery', true);

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Add it to .env.local (see .env.example).');
  }

  if (!cache.promise) {
    // An explicit MONGODB_DB wins; otherwise use the database in the URI path, else `elite_crm`.
    const uriHasDb = /^mongodb(?:\+srv)?:\/\/[^/]+\/[^?/]+/.test(uri);
    cache.promise = mongoose.connect(uri, {
      dbName: process.env.MONGODB_DB || (uriHasDb ? undefined : 'elite_crm'),
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10_000,
      // Build indexes automatically outside production; in production run `npm run db:indexes`.
      autoIndex: process.env.NODE_ENV !== 'production',
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    // Let the next request retry instead of caching a failed connection forever.
    cache.promise = null;
    throw error;
  }
  return cache.conn;
}
