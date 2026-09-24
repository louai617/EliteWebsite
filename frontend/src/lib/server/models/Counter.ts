import mongoose, { Schema, type Model } from 'mongoose';

/** Atomic sequences (e.g. property reference numbers). */
const counterSchema = new Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false }
);

interface CounterDoc {
  _id: string;
  seq: number;
}

export const Counter: Model<CounterDoc> =
  (mongoose.models.Counter as Model<CounterDoc>) || mongoose.model<CounterDoc>('Counter', counterSchema);

export async function nextSequence(name: string): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after', lean: true }
  );
  return doc!.seq;
}
