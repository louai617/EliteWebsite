/** Small projections populated onto viewing / task responses. */
export const VIEWING_POPULATE = [
  { path: 'property', select: 'title_en reference_number location.area_en location.community_en images' },
  { path: 'lead', select: 'full_name phone email' },
  { path: 'client', select: 'full_name phone email' },
  { path: 'assigned_agent', select: 'full_name photo' },
];

export const TASK_POPULATE = [
  { path: 'lead', select: 'full_name phone' },
  { path: 'client', select: 'full_name phone' },
  { path: 'property', select: 'title_en reference_number' },
  { path: 'assigned_agent', select: 'full_name photo' },
];
