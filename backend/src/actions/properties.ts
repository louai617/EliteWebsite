"use server";

import { z } from "zod";
import { authedAction } from "@/lib/action";
import { id, idOnly } from "@/schemas/common";
import { addImageSchema, imageIdSchema, propertySchema, propertyStatusSchema, reorderImagesSchema, updatePropertySchema } from "@/schemas/property";
import {
  addPropertyImage,
  createProperty,
  deleteProperty,
  editableProperty,
  removePropertyImage,
  reorderImages,
  setPrimaryImage,
  setPropertyStatus,
  updateProperty,
} from "@/services/properties";
import { deleteUpload, saveImage } from "@/services/storage";

export const createPropertyAction = authedAction(propertySchema, (input, user) => createProperty(user, input), {
  message: (p) => `Property ${(p as { reference: string }).reference} created`,
});
export const updatePropertyAction = authedAction(updatePropertySchema, (input, user) => updateProperty(user, input), { message: "Property updated" });
export const setPropertyStatusAction = authedAction(propertyStatusSchema, (input, user) => setPropertyStatus(user, input.id, input.status), { message: "Status updated" });
export const deletePropertyAction = authedAction(idOnly, (input, user) => deleteProperty(user, input.id), { message: "Property deleted" });

export const addImageUrlAction = authedAction(addImageSchema, (input, user) => addPropertyImage(user, input.propertyId, input.url), { message: "Photo added" });
export const removeImageAction = authedAction(imageIdSchema, (input, user) => removePropertyImage(user, input.imageId), { message: "Photo removed" });
export const setPrimaryImageAction = authedAction(imageIdSchema, (input, user) => setPrimaryImage(user, input.imageId), { message: "Cover photo updated" });
export const reorderImagesAction = authedAction(reorderImagesSchema, (input, user) => reorderImages(user, input.propertyId, input.imageIds), { message: "Order saved" });

const uploadSchema = z.object({
  propertyId: id,
  file: z.instanceof(File, { error: "Choose an image file" }),
});

/** Multipart upload (FormData: propertyId, file). */
export const uploadImageAction = authedAction(
  z.instanceof(FormData).transform((fd) => ({ propertyId: fd.get("propertyId"), file: fd.get("file") })).pipe(uploadSchema),
  async (input, user) => {
    await editableProperty(user, input.propertyId); // check before touching the disk
    const url = await saveImage(`properties/${input.propertyId}`, input.file);
    try {
      return await addPropertyImage(user, input.propertyId, url);
    } catch (error) {
      await deleteUpload(url);
      throw error;
    }
  },
  { message: "Photo uploaded" },
);
