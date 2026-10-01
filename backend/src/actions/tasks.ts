"use server";

import { authedAction } from "@/lib/action";
import { idOnly } from "@/schemas/common";
import { reassignTaskSchema, taskNoteSchema, taskSchema, taskStatusSchema, updateTaskSchema } from "@/schemas/task";
import { addTaskNote, createTask, deleteTask, reassignTask, setTaskStatus, updateTask } from "@/services/tasks";

export const createTaskAction = authedAction(taskSchema, (input, user) => createTask(user, input), { message: "Task created" });
export const updateTaskAction = authedAction(updateTaskSchema, (input, user) => updateTask(user, input), { message: "Task updated" });
export const setTaskStatusAction = authedAction(taskStatusSchema, (input, user) => setTaskStatus(user, input.id, input.status, input.note), {
  message: (t) => ((t as { status: string }).status === "COMPLETED" ? "Task completed" : "Task updated"),
});
export const reassignTaskAction = authedAction(reassignTaskSchema, (input, user) => reassignTask(user, input), { message: "Task reassigned" });
export const addTaskNoteAction = authedAction(taskNoteSchema, (input, user) => addTaskNote(user, input.id, input.message), { message: "Note added" });
export const deleteTaskAction = authedAction(idOnly, (input, user) => deleteTask(user, input.id), { message: "Task deleted" });
