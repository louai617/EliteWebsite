import mongoose, { Schema, type HydratedDocument, type InferSchemaType, type Model } from 'mongoose';
import { PRIORITIES, TASK_TYPES } from '@/lib/shared/constants';
import { baseSchemaOptions } from './common';

/** A follow-up / to-do for an agent, optionally tied to a lead or client. */
const taskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 5000 },
    type: { type: String, enum: TASK_TYPES, default: 'follow_up' },
    priority: { type: String, enum: PRIORITIES, default: 'medium' },

    lead: { type: Schema.Types.ObjectId, ref: 'Lead' },
    client: { type: Schema.Types.ObjectId, ref: 'Client' },
    property: { type: Schema.Types.ObjectId, ref: 'Property' },
    assigned_agent: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    due_at: { type: Date },
    completed: { type: Boolean, default: false },
    completed_at: { type: Date },
    created_by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  baseSchemaOptions
);

taskSchema.pre('validate', function (this: HydratedDocument<TaskDoc>) {
  if (this.completed && !this.completed_at) this.completed_at = new Date();
  if (!this.completed) this.completed_at = undefined;
});

taskSchema.index({ assigned_agent: 1, completed: 1, due_at: 1 });
taskSchema.index({ completed: 1, due_at: 1 });
taskSchema.index({ lead: 1 });
taskSchema.index({ client: 1 });

export type TaskDoc = InferSchemaType<typeof taskSchema> & { _id: mongoose.Types.ObjectId };

export const Task: Model<TaskDoc> =
  (mongoose.models.Task as Model<TaskDoc>) || mongoose.model<TaskDoc>('Task', taskSchema);
